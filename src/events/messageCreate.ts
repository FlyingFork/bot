import {
  Message,
  TextChannel,
  ThreadChannel,
  AttachmentPayload,
  AllowedMentionsTypes,
} from "discord.js";
import { BotEvent } from "@/types/index";
import db from "@/utils/db";
import { translateText, detectLanguage, isEmojiOrSymbolOnly, sanitizeTextForDetection } from "@/utils/translate";
import { getOrCreateWebhook, isOwnWebhook } from "@/utils/webhook";
import { checkRateLimit } from "@/utils/rateLimiter";
import { storeForwardedMessage } from "@/utils/messageCache";
import type { TranslationChannel } from "@/generated/prisma/client";

const CONFIDENCE_THRESHOLD = 0.85;
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024; // 8 MB

const ALLOWED_MENTIONS = { parse: [] as AllowedMentionsTypes[] };

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function buildAttachments(message: Message): AttachmentPayload[] {
  return [...message.attachments.values()].map((att) => {
    if (att.size > MAX_ATTACHMENT_BYTES) {
      // Too large to re-upload — return as a sentinel that callers handle
      return { attachment: att.url, name: att.name ?? "file", tooBig: true } as AttachmentPayload & { tooBig: boolean };
    }
    return { attachment: att.url, name: att.name ?? "file" };
  });
}

function buildStickerText(message: Message): string {
  if (message.stickers.size === 0) return "";
  return [...message.stickers.values()]
    .map((s) => `[${s.name}](https://media.discordapp.net/stickers/${s.id}.png)`)
    .join(" ");
}

function buildDisplayName(message: Message): string {
  const raw =
    message.member?.nickname ??
    message.author.globalName ??
    message.author.username;
  return (raw ?? "User").slice(0, 80) || "User";
}

async function upsertTranslationStat(
  guildId: string,
  channelId: string,
): Promise<void> {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  await db.translationStat
    .upsert({
      where: { guildId_channelId_date: { guildId, channelId, date } },
      update: { count: { increment: 1 } },
      create: { guildId, channelId, date, count: 1 },
    })
    .catch((err) =>
      console.error("[messageCreate] Failed to upsert TranslationStat:", err),
    );
}

async function sendViaWebhook(
  targetChannel: TextChannel,
  channelRecord: TranslationChannel,
  content: string | undefined,
  attachments: (AttachmentPayload & { tooBig?: boolean })[],
  stickerText: string,
  displayName: string,
  avatarURL: string,
): Promise<string[]> {
  const webhook = await getOrCreateWebhook(targetChannel, channelRecord);

  // Separate oversized attachments — include their CDN links inline instead
  const sendableFiles = attachments.filter((a) => !(a as { tooBig?: boolean }).tooBig);
  const bigFileLinks = attachments
    .filter((a) => (a as { tooBig?: boolean }).tooBig)
    .map((a) => `📎 [${a.name}](${a.attachment})`);

  // Assemble full content: translated text + stickers + big file links
  const parts = [content, stickerText, ...bigFileLinks].filter(Boolean);
  const fullContent = parts.join("\n").trim() || undefined;

  const chunks = fullContent ? splitContent(fullContent) : [""];

  const sentIds: string[] = [];

  // First chunk carries the attachments
  const first = await webhook.send({
    content: chunks[0] || undefined,
    username: displayName,
    avatarURL,
    ...(sendableFiles.length > 0 ? { files: sendableFiles } : {}),
    allowedMentions: ALLOWED_MENTIONS,
  });
  sentIds.push(first.id);

  // Overflow chunks
  for (const chunk of chunks.slice(1)) {
    const msg = await webhook.send({
      content: chunk,
      username: displayName,
      avatarURL,
      allowedMentions: ALLOWED_MENTIONS,
    });
    sentIds.push(msg.id);
  }

  return sentIds;
}

// ── Event ─────────────────────────────────────────────────────────────────────

const event: BotEvent<"messageCreate"> = {
  name: "messageCreate",

  async execute(message: Message) {
    // ── Pre-flight ────────────────────────────────────────────────────────────
    if (message.author.bot) return;
    if (message.webhookId && isOwnWebhook(message.webhookId)) return;
    if (message.system) return;
    if (!message.guild) return;

    // Thread messages: check parent channel membership
    let effectiveChannelId: string;
    let isThread = false;
    let threadName: string | null = null;

    if (message.channel instanceof ThreadChannel) {
      if (!message.channel.parentId) return;
      effectiveChannelId = message.channel.parentId;
      isThread = true;
      threadName = message.channel.name;
    } else if (message.channel instanceof TextChannel) {
      effectiveChannelId = message.channelId;
    } else {
      return;
    }

    // ── DB lookup ─────────────────────────────────────────────────────────────
    const sourceRecord = await db.translationChannel.findUnique({
      where: { channelId: effectiveChannelId },
    });
    if (!sourceRecord) return;

    const group = await db.translationGroup.findUnique({
      where: { id: sourceRecord.groupId },
      include: { channels: true },
    });
    if (!group) return;

    const siblings = group.channels.filter(
      (ch) => ch.channelId !== effectiveChannelId,
    );
    if (siblings.length === 0) return;

    const guildId = message.guild.id;

    // ── Rate limiting ─────────────────────────────────────────────────────────
    if (!checkRateLimit(guildId, message.author.id)) {
      console.log(
        `[messageCreate] Rate limit exceeded for user ${message.author.id} in guild ${guildId}`,
      );
      return;
    }

    // ── Content classification ────────────────────────────────────────────────
    const rawText = message.content.trim();
    const hasText = rawText.length > 0;
    const hasAttachments = message.attachments.size > 0;
    const hasStickers = message.stickers.size > 0;

    if (!hasText && !hasAttachments && !hasStickers) return;

    const attachments = buildAttachments(message);
    const stickerText = buildStickerText(message);
    const displayName = buildDisplayName(message);
    const avatarURL = message.author.displayAvatarURL();
    const sourceLang = sourceRecord.language;

    // Reply prefix
    const replyPrefix = message.reference ? "↩️ Reply\n" : "";

    // ── Language detection (only to catch wrong-language messages) ────────────
    let languageMismatch = false;
    // detectedLang is the actual language of the text — used as source in the mismatch flow
    let detectedLang: string = sourceLang;
    if (hasText) {
      // Strip Discord tokens before detection: large mention IDs like <@123456789012345678>
      // push Argos's confidence below the threshold, causing mismatch to be missed.
      const textForDetection = sanitizeTextForDetection(rawText);
      const detected = await detectLanguage(textForDetection);
      if (
        detected.confidence >= CONFIDENCE_THRESHOLD &&
        detected.lang !== "unknown" &&
        detected.lang !== sourceLang
      ) {
        languageMismatch = true;
        detectedLang = detected.lang;
      }
    }

    // ── Wrong-language mismatch flow ──────────────────────────────────────────
    if (languageMismatch) {
      // Delete original first, silently absorb permission errors
      await message
        .delete()
        .catch((err) =>
          console.warn(`[messageCreate] Could not delete wrong-lang message ${message.id}:`, err),
        );

      // Translate and forward to ALL channels in the group (including source)
      for (const targetRecord of group.channels) {
        try {
          const targetChannelId = targetRecord.channelId;
          const targetLang = targetRecord.language;

          const targetDiscordChannel = (
            message.client.channels.cache.get(targetChannelId) ??
            (await message.client.channels.fetch(targetChannelId).catch(() => null))
          ) as TextChannel | null;

          if (!(targetDiscordChannel instanceof TextChannel)) continue;

          let translatedText = rawText;
          if (hasText && !isEmojiOrSymbolOnly(rawText)) {
            // Use detectedLang (the actual language of the text) as source, not the
            // channel's configured language — they differ by definition in this branch.
            translatedText = await translateText(rawText, detectedLang, targetLang).catch(
              (err) => {
                console.error(
                  `[messageCreate] Mismatch translation to ${targetLang} failed:`,
                  err,
                );
                return rawText;
              },
            );
          }

          const content = hasText
            ? replyPrefix + translatedText
            : replyPrefix || undefined;

          const sentIds = await sendViaWebhook(
            targetDiscordChannel,
            targetRecord,
            content || undefined,
            attachments,
            stickerText,
            displayName,
            avatarURL,
          );

          storeForwardedMessage(guildId, message.id, targetChannelId, sentIds);
          await upsertTranslationStat(guildId, targetChannelId);
        } catch (err) {
          console.error(
            `[messageCreate] Mismatch forward to ${targetRecord.channelId} failed:`,
            err,
          );
        }
      }
      return;
    }

    // ── Normal forwarding flow ────────────────────────────────────────────────
    for (const siblingRecord of siblings) {
      try {
        const targetChannelId = siblingRecord.channelId;
        const targetLang = siblingRecord.language;

        // Resolve thread target if needed
        let targetDiscordChannel: TextChannel | null = null;

        if (isThread && threadName) {
          const parentChannel = (
            message.client.channels.cache.get(targetChannelId) ??
            (await message.client.channels.fetch(targetChannelId).catch(() => null))
          ) as TextChannel | null;

          if (parentChannel instanceof TextChannel) {
            // Find or create a thread with the same name in the sibling channel
            try {
              const threads = await parentChannel.threads.fetchActive();
              let targetThread = threads.threads.find((t) => t.name === threadName);
              if (!targetThread) {
                targetThread = await parentChannel.threads.create({
                  name: threadName,
                  autoArchiveDuration: 1440,
                });
              }
              // ThreadChannels accept webhook messages via the parent channel webhook
              // with a thread_id. We fall back to parent channel for webhook send.
              targetDiscordChannel = parentChannel;
            } catch (threadErr) {
              console.warn(
                `[messageCreate] Thread handling failed for ${targetChannelId}, falling back to parent:`,
                threadErr,
              );
              targetDiscordChannel = parentChannel;
            }
          }
        } else {
          targetDiscordChannel = (
            message.client.channels.cache.get(targetChannelId) ??
            (await message.client.channels.fetch(targetChannelId).catch(() => null))
          ) as TextChannel | null;
        }

        if (!(targetDiscordChannel instanceof TextChannel)) {
          console.warn(
            `[messageCreate] Could not resolve TextChannel for ${targetChannelId}, skipping.`,
          );
          continue;
        }

        // Translate text if needed
        let translatedText = rawText;
        if (hasText) {
          if (sourceLang === targetLang || isEmojiOrSymbolOnly(rawText)) {
            translatedText = rawText;
          } else {
            try {
              translatedText = await translateText(rawText, sourceLang, targetLang);
            } catch (err) {
              console.error(
                `[messageCreate] Translation to ${targetLang} failed (all retries exhausted):`,
                err,
              );
              // Notify author ephemerally and skip this channel
              await message
                .reply({
                  content:
                    "⚠️ Translation service is currently unavailable. Your message was not forwarded.",
                })
                .catch(() => {});
              continue;
            }
          }
        }

        const content = hasText
          ? replyPrefix + translatedText
          : replyPrefix || undefined;

        const sentIds = await sendViaWebhook(
          targetDiscordChannel,
          siblingRecord,
          content || undefined,
          attachments,
          stickerText,
          displayName,
          avatarURL,
        );

        storeForwardedMessage(guildId, message.id, targetChannelId, sentIds);
        await upsertTranslationStat(guildId, targetChannelId);

        console.log(
          `[messageCreate] Forwarded ${message.id} → ${targetChannelId} (${sourceLang}→${targetLang}) len=${rawText.length}`,
        );
      } catch (err) {
        console.error(
          `[messageCreate] Failed to forward to ${siblingRecord.channelId}:`,
          err,
        );
      }
    }
  },
};

export default event;
