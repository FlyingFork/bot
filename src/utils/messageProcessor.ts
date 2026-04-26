import {
  Message,
  TextChannel,
  ThreadChannel,
  AttachmentPayload,
  AllowedMentionsTypes,
} from "discord.js";
import type {
  TranslationChannel,
  TranslationGroup,
} from "@/generated/prisma/client";
import db from "@/utils/db";
import {
  translateText,
  detectLanguage,
  isEmojiOrSymbolOnly,
  sanitizeTextForDetection,
} from "@/utils/translate";
import { getOrCreateWebhook } from "@/utils/webhook";
import { checkRateLimit } from "@/utils/rateLimiter";
import { storeForwardedMessage } from "@/utils/messageCache";

const CONFIDENCE_THRESHOLD = 0.85;
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024; // 8 MB

const ALLOWED_MENTIONS = { parse: [] as AllowedMentionsTypes[] };

export interface MessageChannelContext {
  effectiveChannelId: string;
  isThread: boolean;
  threadName: string | null;
}

export interface ProcessTranslationMessageOptions {
  contextTag?: string;
  skipRateLimit?: boolean;
  allowMismatchDelete?: boolean;
  notifyTranslationFailureToAuthor?: boolean;
  channelContext?: MessageChannelContext;
}

export interface ProcessTranslationMessageResult {
  forwardedCount: number;
  mismatchDetected: boolean;
  reason?: "no-targets" | "rate-limited" | "no-content";
}

export function getMessageChannelContext(
  message: Message,
): MessageChannelContext | null {
  if (message.channel instanceof ThreadChannel) {
    if (!message.channel.parentId) return null;
    return {
      effectiveChannelId: message.channel.parentId,
      isThread: true,
      threadName: message.channel.name,
    };
  }

  if (message.channel instanceof TextChannel) {
    return {
      effectiveChannelId: message.channelId,
      isThread: false,
      threadName: null,
    };
  }

  return null;
}

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
      // Too large to re-upload; send as CDN links in message body.
      return {
        attachment: att.url,
        name: att.name ?? "file",
        tooBig: true,
      } as AttachmentPayload & { tooBig: boolean };
    }
    return { attachment: att.url, name: att.name ?? "file" };
  });
}

function buildStickerText(message: Message): string {
  if (message.stickers.size === 0) return "";
  return [...message.stickers.values()]
    .map(
      (s) => `[${s.name}](https://media.discordapp.net/stickers/${s.id}.png)`,
    )
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
  contextTag: string,
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
      console.error(`[${contextTag}] Failed to upsert TranslationStat:`, err),
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

  const sendableFiles = attachments.filter(
    (a) => !(a as { tooBig?: boolean }).tooBig,
  );
  const bigFileLinks = attachments
    .filter((a) => (a as { tooBig?: boolean }).tooBig)
    .map((a) => `📎 [${a.name}](${a.attachment})`);

  const parts = [content, stickerText, ...bigFileLinks].filter(Boolean);
  const fullContent = parts.join("\n").trim() || undefined;
  const chunks = fullContent ? splitContent(fullContent) : [""];

  const sentIds: string[] = [];

  const first = await webhook.send({
    content: chunks[0] || undefined,
    username: displayName,
    avatarURL,
    ...(sendableFiles.length > 0 ? { files: sendableFiles } : {}),
    allowedMentions: ALLOWED_MENTIONS,
  });
  sentIds.push(first.id);

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

export async function processTranslationMessage(
  message: Message,
  sourceRecord: TranslationChannel,
  group: TranslationGroup & { channels: TranslationChannel[] },
  options: ProcessTranslationMessageOptions = {},
): Promise<ProcessTranslationMessageResult> {
  const contextTag = options.contextTag ?? "messageProcessor";
  const skipRateLimit = options.skipRateLimit ?? false;
  const allowMismatchDelete = options.allowMismatchDelete ?? true;
  const notifyTranslationFailureToAuthor =
    options.notifyTranslationFailureToAuthor ?? true;

  const channelContext =
    options.channelContext ?? getMessageChannelContext(message);
  const isThread = channelContext?.isThread ?? false;
  const threadName = channelContext?.threadName ?? null;

  const siblings = group.channels.filter(
    (ch) => ch.channelId !== sourceRecord.channelId,
  );
  if (siblings.length === 0) {
    return { forwardedCount: 0, mismatchDetected: false, reason: "no-targets" };
  }

  const guildId = message.guild?.id;
  if (!guildId) {
    return { forwardedCount: 0, mismatchDetected: false, reason: "no-targets" };
  }

  if (!skipRateLimit && !checkRateLimit(guildId, message.author.id)) {
    console.log(
      `[${contextTag}] Rate limit exceeded for user ${message.author.id} in guild ${guildId}`,
    );
    return {
      forwardedCount: 0,
      mismatchDetected: false,
      reason: "rate-limited",
    };
  }

  const rawText = message.content.trim();
  const hasText = rawText.length > 0;
  const hasAttachments = message.attachments.size > 0;
  const hasStickers = message.stickers.size > 0;

  if (!hasText && !hasAttachments && !hasStickers) {
    return { forwardedCount: 0, mismatchDetected: false, reason: "no-content" };
  }

  const attachments = buildAttachments(message);
  const stickerText = buildStickerText(message);
  const displayName = buildDisplayName(message);
  const avatarURL = message.author.displayAvatarURL();
  const sourceLang = sourceRecord.language;
  const replyPrefix = message.reference ? "↩️ Reply\n" : "";

  let forwardedCount = 0;
  let languageMismatch = false;
  let detectedLang: string = sourceLang;

  if (hasText) {
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

  if (languageMismatch) {
    if (allowMismatchDelete) {
      await message
        .delete()
        .catch((err) =>
          console.warn(
            `[${contextTag}] Could not delete wrong-lang message ${message.id}:`,
            err,
          ),
        );
    }

    for (const targetRecord of group.channels) {
      try {
        const targetChannelId = targetRecord.channelId;
        const targetLang = targetRecord.language;

        const targetDiscordChannel = (message.client.channels.cache.get(
          targetChannelId,
        ) ??
          (await message.client.channels
            .fetch(targetChannelId)
            .catch(() => null))) as TextChannel | null;

        if (!(targetDiscordChannel instanceof TextChannel)) continue;

        let translatedText = rawText;
        if (hasText && !isEmojiOrSymbolOnly(rawText)) {
          translatedText = await translateText(
            rawText,
            detectedLang,
            targetLang,
          ).catch((err) => {
            console.error(
              `[${contextTag}] Mismatch translation to ${targetLang} failed:`,
              err,
            );
            return rawText;
          });
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
        await upsertTranslationStat(guildId, targetChannelId, contextTag);
        forwardedCount++;
      } catch (err) {
        console.error(
          `[${contextTag}] Mismatch forward to ${targetRecord.channelId} failed:`,
          err,
        );
      }
    }

    return { forwardedCount, mismatchDetected: true };
  }

  for (const siblingRecord of siblings) {
    try {
      const targetChannelId = siblingRecord.channelId;
      const targetLang = siblingRecord.language;

      let targetDiscordChannel: TextChannel | null = null;

      if (isThread && threadName) {
        const parentChannel = (message.client.channels.cache.get(
          targetChannelId,
        ) ??
          (await message.client.channels
            .fetch(targetChannelId)
            .catch(() => null))) as TextChannel | null;

        if (parentChannel instanceof TextChannel) {
          try {
            const threads = await parentChannel.threads.fetchActive();
            let targetThread = threads.threads.find(
              (t) => t.name === threadName,
            );
            if (!targetThread) {
              targetThread = await parentChannel.threads.create({
                name: threadName,
                autoArchiveDuration: 1440,
              });
            }
            targetDiscordChannel = parentChannel;
          } catch (threadErr) {
            console.warn(
              `[${contextTag}] Thread handling failed for ${targetChannelId}, falling back to parent:`,
              threadErr,
            );
            targetDiscordChannel = parentChannel;
          }
        }
      } else {
        targetDiscordChannel = (message.client.channels.cache.get(
          targetChannelId,
        ) ??
          (await message.client.channels
            .fetch(targetChannelId)
            .catch(() => null))) as TextChannel | null;
      }

      if (!(targetDiscordChannel instanceof TextChannel)) {
        console.warn(
          `[${contextTag}] Could not resolve TextChannel for ${targetChannelId}, skipping.`,
        );
        continue;
      }

      let translatedText = rawText;
      if (hasText) {
        if (sourceLang === targetLang || isEmojiOrSymbolOnly(rawText)) {
          translatedText = rawText;
        } else {
          try {
            translatedText = await translateText(
              rawText,
              sourceLang,
              targetLang,
            );
          } catch (err) {
            console.error(
              `[${contextTag}] Translation to ${targetLang} failed (all retries exhausted):`,
              err,
            );

            if (notifyTranslationFailureToAuthor) {
              await message
                .reply({
                  content:
                    "⚠️ Translation service is currently unavailable. Your message was not forwarded.",
                })
                .catch(() => {});
            }
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
      await upsertTranslationStat(guildId, targetChannelId, contextTag);
      forwardedCount++;

      console.log(
        `[${contextTag}] Forwarded ${message.id} -> ${targetChannelId} (${sourceLang}->${targetLang}) len=${rawText.length}`,
      );
    } catch (err) {
      console.error(
        `[${contextTag}] Failed to forward to ${siblingRecord.channelId}:`,
        err,
      );
    }
  }

  return { forwardedCount, mismatchDetected: false };
}
