import { Message, TextChannel, AttachmentPayload } from "discord.js";
import { BotEvent } from "@/types/index";
import db from "@/utils/db";
import { translateText, detectLanguage } from "@/utils/translate";
import { getOrCreateWebhook } from "@/utils/webhook";

type TranslationEventKind = "FORWARDED" | "SOURCE_CORRECTION";

// Minimum language detection confidence required to act on a mismatch.
const CONFIDENCE_THRESHOLD = 0.85;

/**
 * Splits text into chunks that fit within Discord's message length limit.
 * Splits at the last space before maxLen to avoid cutting words.
 */
function splitContent(text: string, maxLen = 1990): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    let cut = remaining.lastIndexOf(" ", maxLen);
    if (cut <= 0) cut = maxLen;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).trimStart();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

// Build the file attachment list for a webhook send using original URLs.
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

    // E6: Ensure the source channel is a proper TextChannel before any webhook work.
    if (!(message.channel instanceof TextChannel)) {
      console.warn(
        `[messageCreate] Channel ${message.channelId} is not a TextChannel, skipping.`,
      );
      return;
    }
    const sourceChannel = message.channel;

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

    // T5: use the configured channel language when detection is uncertain so
    // stats don't accumulate meaningless "unknown" source-language entries.
    const effectiveSourceLanguage =
      detected !== null &&
      detected.confidence >= CONFIDENCE_THRESHOLD &&
      detectedLanguage !== "unknown"
        ? detectedLanguage
        : sourceLanguage;

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

        // E1: split to honour Discord's 2000-char limit
        const correctedChunks = correctedText ? splitContent(correctedText) : [];
        await sourceWebhook.send({
          content: correctedChunks[0] || undefined,
          username: displayName,
          avatarURL: message.author.displayAvatarURL(),
          ...(attachments.length > 0 ? { files: attachments } : {}),
        });
        for (const chunk of correctedChunks.slice(1)) {
          await sourceWebhook
            .send({ content: chunk, username: displayName, avatarURL: message.author.displayAvatarURL() })
            .catch((err) =>
              console.error("[messageCreate] Failed to send correction overflow chunk:", err),
            );
        }

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
            sourceLanguage: effectiveSourceLanguage,
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
        // B3: fall back to API fetch if the channel is not in the local cache
        const siblingChannel = (
          message.client.channels.cache.get(sibling.channelId) ??
          (await message.client.channels
            .fetch(sibling.channelId)
            .catch(() => null))
        ) as TextChannel | null;

        if (!siblingChannel) {
          console.warn(
            `[messageCreate] Sibling channel ${sibling.channelId} not in cache and fetch failed.`,
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

        // E1: split translated text to honour Discord's 2000-char limit.
        // Only the first chunk's message ID is tracked for edit/delete sync.
        const chunks = translatedText ? splitContent(translatedText) : [];
        const sent = await webhook.send({
          content: chunks[0] || undefined,
          username: displayName,
          avatarURL: message.author.displayAvatarURL(),
          ...(attachments.length > 0 ? { files: attachments } : {}),
        });
        for (const chunk of chunks.slice(1)) {
          await webhook
            .send({ content: chunk, username: displayName, avatarURL: message.author.displayAvatarURL() })
            .catch((err) =>
              console.error(
                `[messageCreate] Failed to send overflow chunk to ${sibling.channelId}:`,
                err,
              ),
            );
        }

        if (hasText) {
          await recordTranslationEvent({
            guildId,
            sourceChannelId: message.channelId,
            targetChannelId: sibling.channelId,
            sourceMessageId: message.id,
            sourceLanguage: effectiveSourceLanguage,
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
