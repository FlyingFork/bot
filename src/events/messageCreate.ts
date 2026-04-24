import { Message, TextChannel, AttachmentPayload } from "discord.js";
import { BotEvent } from "@/types/index";
import db from "@/utils/db";
import { translateText, detectLanguage } from "@/utils/translate";
import { getOrCreateWebhook } from "@/utils/webhook";

type TranslationEventKind = "FORWARDED" | "SOURCE_CORRECTION";

// Minimum language detection confidence required to act on a mismatch.
const CONFIDENCE_THRESHOLD = 0.85;

// Build the file attachment list for a webhook send using original URLs.
// Voice messages (audio/*) are forwarded as-is; other files are included by URL.
function buildAttachments(message: Message): AttachmentPayload[] {
  return message.attachments.map((att) => ({
    attachment: att.url,
    name: att.name ?? "file",
  }));
}

async function recordTranslationEvent(params: {
  guildId: string;
  sourceChannelId: string;
  targetChannelId: string;
  sourceMessageId: string;
  sourceLanguage: string;
  targetLanguage: string;
  kind: TranslationEventKind;
}): Promise<void> {
  await db.translationEvent
    .create({
      data: params,
    })
    .catch((err) => {
      console.error("[messageCreate] Failed to record translation event:", err);
    });
}

const event: BotEvent<"messageCreate"> = {
  name: "messageCreate",

  async execute(message: Message) {
    // ── Ignore bots and webhook-forwarded messages (prevents translation loops) ──
    if (message.author.bot || message.webhookId) return;

    // ── Check if this channel is part of a translation group ─────────────────
    const sourceMember = await db.channelGroupMember.findFirst({
      where: { channelId: message.channelId },
    });
    if (!sourceMember) return;

    // ── Load the full group with all sibling channels ─────────────────────────
    const group = await db.channelGroup.findUnique({
      where: { id: sourceMember.groupId },
      include: { members: true },
    });
    if (!group) return;

    const siblings = group.members.filter(
      (m) => m.channelId !== message.channelId,
    );
    if (siblings.length === 0) return;

    const guildId = message.guildId;
    if (!guildId) return;

    const sourceLanguage = sourceMember.languageCode;
    const hasText = message.content.trim().length > 0;
    const attachments = buildAttachments(message);

    // Use member's nickname if available, otherwise fall back to Discord name
    const displayName = message.member?.nickname ?? message.author.displayName;

    // ── Language detection ────────────────────────────────────────────────────
    // Skip detection entirely if there is no text content (image-only, audio, etc.)
    let detected: { lang: string; confidence: number } | null = null;

    if (hasText) {
      detected = await detectLanguage(message.content);
    }

    const detectedLanguage = detected?.lang ?? "unknown";

    // A message is considered "correct language" if:
    //   - there is no text to detect on
    //   - detection confidence is below the threshold
    //   - the detected language matches the channel's expected language
    const confidenceOk =
      detected !== null && detected.confidence >= CONFIDENCE_THRESHOLD;
    const languageMismatch = confidenceOk && detected!.lang !== sourceLanguage;

    // ── Correct language mismatch in the source channel ───────────────────────
    // Repost a translated version via webhook first, then delete the original
    // only after the corrected message is safely sent.
    if (languageMismatch) {
      try {
        const sourceChannel = message.channel as TextChannel;
        const sourceWebhook = await getOrCreateWebhook(sourceChannel);

        // Translate to the channel's expected language; voice messages carry no text.
        const correctedText = hasText
          ? await translateText(message.content, sourceLanguage).catch(
              (err) => {
                console.error(
                  "[messageCreate] Source translation failed:",
                  err,
                );
                return message.content; // fallback to original
              },
            )
          : "";

        await sourceWebhook.send({
          content: correctedText || undefined,
          username: displayName,
          avatarURL: message.author.displayAvatarURL(),
          ...(attachments.length > 0 ? { files: attachments } : {}),
        });

        // Delete original — if it fails (missing permissions), log and keep the
        // corrected message so the content and attachments are not lost.
        await message
          .delete()
          .catch((err) =>
            console.error(
              `[messageCreate] Failed to delete message ${message.id}:`,
              err,
            ),
          );

        if (hasText) {
          await recordTranslationEvent({
            guildId,
            sourceChannelId: message.channelId,
            targetChannelId: message.channelId,
            sourceMessageId: message.id,
            sourceLanguage: detectedLanguage,
            targetLanguage: sourceLanguage,
            kind: "SOURCE_CORRECTION",
          });
        }
      } catch (err) {
        console.error(
          "[messageCreate] Failed to repost corrected message in source channel:",
          err,
        );
      }
    }

    // ── Forward (with translation) to every sibling channel ──────────────────
    for (const sibling of siblings) {
      try {
        const siblingChannel = message.client.channels.cache.get(
          sibling.channelId,
        ) as TextChannel | undefined;

        if (!siblingChannel) {
          console.warn(
            `[messageCreate] Sibling channel ${sibling.channelId} not in cache.`,
          );
          continue;
        }

        const webhook = await getOrCreateWebhook(siblingChannel);

        // Translate text content; skip translation for attachment-only messages.
        let translatedText = "";
        if (hasText) {
          translatedText = await translateText(
            message.content,
            sibling.languageCode,
          ).catch((err) => {
            console.error(
              `[messageCreate] Translation to ${sibling.languageCode} failed:`,
              err,
            );
            return message.content; // fallback to original
          });
        }

        const sent = await webhook.send({
          content: translatedText || undefined,
          username: displayName,
          avatarURL: message.author.displayAvatarURL(),
          ...(attachments.length > 0 ? { files: attachments } : {}),
        });

        if (hasText) {
          await recordTranslationEvent({
            guildId,
            sourceChannelId: message.channelId,
            targetChannelId: sibling.channelId,
            sourceMessageId: message.id,
            sourceLanguage: detectedLanguage,
            targetLanguage: sibling.languageCode,
            kind: "FORWARDED",
          });
        }

        if (!languageMismatch) {
          await db.forwardedMessage
            .create({
              data: {
                sourceMessageId: message.id,
                sourceChannelId: message.channelId,
                targetChannelId: sibling.channelId,
                webhookMessageId: sent.id,
              },
            })
            .catch((err) =>
              console.error(
                `[messageCreate] Failed to record ForwardedMessage for ${message.id}:`,
                err,
              ),
            );
        }
      } catch (err) {
        // A single channel failure must not abort the rest.
        console.error(
          `[messageCreate] Failed to forward to channel ${sibling.channelId}:`,
          err,
        );
      }
    }
  },
};

export default event;
