import {
  AttachmentBuilder,
  ChannelType,
  type Client,
  type Message,
  type NewsChannel,
  type PartialMessage,
  type TextChannel,
  type ThreadChannel
} from "discord.js";
import type { GroupChannel, Language } from "@tiles-survive/database";
import { prisma } from "../db.js";
import { logger } from "../logger.js";
import { detectLanguage, translateText } from "../services/libreTranslate.js";
import { logToAdmin } from "../services/adminLog.js";
import { messageTextWithStickers } from "../services/translationFormatter.js";
import { canUseWebhook, deleteWebhookMessage, editWebhookMessage, sendWebhookMessage } from "../services/webhooks.js";

const cooldowns = new Map<string, number>();
const COOLDOWN_MS = 2000;
const SYNC_WINDOW_MS = 15 * 60 * 1000;

export function registerMessageEvents(client: Client): void {
  client.on("messageCreate", async (message) => {
    await translateMessage(message).catch(async (error) => {
      logger.error({ error }, "messageCreate failed");
      await logToAdmin(message.guild, `Translation error: ${error instanceof Error ? error.message : String(error)}`);
    });
  });

  client.on("messageUpdate", async (_oldMessage, newMessage) => {
    await handleMessageUpdate(newMessage).catch(async (error) => {
      logger.error({ error }, "messageUpdate failed");
      await logToAdmin(newMessage.guild ?? null, `Edit sync error: ${error instanceof Error ? error.message : String(error)}`);
    });
  });

  client.on("messageDelete", async (message) => {
    await handleMessageDelete(message).catch(async (error) => {
      logger.error({ error }, "messageDelete failed");
      await logToAdmin(message.guild ?? null, `Delete sync error: ${error instanceof Error ? error.message : String(error)}`);
    });
  });
}

export async function translateMessage(message: Message, options: { bypassCooldown?: boolean } = {}): Promise<void> {
  if (!message.guild || message.author.bot || message.webhookId) return;

  const context = await resolveTranslationContext(message);
  if (context.length === 0) return;

  const existing = await prisma.messageMap.count({
    where: {
      guildId: message.guild.id,
      sourceChannelId: message.channel.id,
      sourceMessageId: message.id
    }
  });
  if (existing > 0) return;

  const cooldownKey = `${message.guild.id}:${message.author.id}`;
  const now = Date.now();
  if (!options.bypassCooldown && (cooldowns.get(cooldownKey) ?? 0) > now) {
    await logToAdmin(message.guild, `Cooldown skipped translation from <@${message.author.id}> in <#${message.channel.id}>.`);
    return;
  }
  if (!options.bypassCooldown) {
    cooldowns.set(cooldownKey, now + COOLDOWN_MS);
  }

  const sourceText = messageTextWithStickers(message.content, message.stickers.values());
  const username = message.member?.displayName ?? message.author.username;
  const avatarURL = message.member?.displayAvatarURL() ?? message.author.displayAvatarURL();

  const detected = sourceText.trim() ? await detectLanguage(sourceText, message.guild.id) : null;

  // If the detected language doesn't match the configured language for every group this channel
  // belongs to, and the message is long enough to detect reliably, auto-correct by sending the
  // proper translations to all channels (including source) and deleting the original.
  if (
    message.channel.type !== ChannelType.PublicThread &&
    message.channel.type !== ChannelType.AnnouncementThread &&
    sourceText.trim().length >= 10 &&
    detected !== null &&
    context.every((item) => detected !== item.source.language)
  ) {
    await handleWrongLanguageMessage(message, context, detected, username, avatarURL, sourceText);
    return;
  }

  const files = [...message.attachments.values()].map((attachment) => attachment.url);

  for (const item of context) {
    const sourceLanguage = detected ?? item.source.language;

    for (const target of item.targets) {
      const targetChannel = await resolveTargetChannel(message, target.channelId, item.threadTargetId);
      if (!targetChannel) continue;

      const translated = sourceText.trim()
        ? await translateText(sourceText, sourceLanguage, target.language, message.guild.id)
        : { chunks: [""], latencyMs: 0 };

      const sentIds: string[] = [];
      for (const [index, chunk] of translated.chunks.entries()) {
        const sentId = await sendWebhookMessage({
          channel: targetChannel,
          content: chunk || " ",
          username,
          avatarURL,
          files: index === 0 ? files : undefined
        });
        sentIds.push(sentId);
      }

      await prisma.messageMap.create({
        data: {
          guildId: message.guild.id,
          groupId: item.groupId,
          sourceChannelId: message.channel.id,
          sourceMessageId: message.id,
          targetChannelId: targetChannel.id,
          targetMessageIds: sentIds
        }
      });

      await prisma.translationStat.create({
        data: {
          guildId: message.guild.id,
          groupId: item.groupId,
          sourceChannelId: message.channel.id,
          targetChannelId: targetChannel.id,
          sourceLanguage,
          targetLanguage: target.language,
          latencyMs: translated.latencyMs,
          translatedMessages: translated.chunks.length
        }
      });
    }
  }
}

async function downloadAttachments(message: Message): Promise<AttachmentBuilder[]> {
  const builders: AttachmentBuilder[] = [];
  for (const attachment of message.attachments.values()) {
    try {
      const response = await fetch(attachment.url);
      const buffer = Buffer.from(await response.arrayBuffer());
      builders.push(new AttachmentBuilder(buffer, { name: attachment.name }));
    } catch (error) {
      logger.warn({ error, url: attachment.url }, "failed to download attachment for wrong-language correction");
    }
  }
  return builders;
}

async function handleWrongLanguageMessage(
  message: Message,
  context: TranslationContext[],
  detectedLanguage: Language,
  username: string,
  avatarURL: string,
  sourceText: string
): Promise<void> {
  const attachmentBuilders = await downloadAttachments(message);
  // Track sent message IDs per channel to avoid duplicate sends when a channel belongs to multiple groups
  const sentByChannelId = new Map<string, string[]>();

  for (const item of context) {
    const allChannels = [item.source, ...item.targets];

    for (const groupChannel of allChannels) {
      if (sentByChannelId.has(groupChannel.channelId)) continue;

      const discordChannel = groupChannel.channelId === message.channel.id
        ? (canUseWebhook(message.channel) ? message.channel : null)
        : await resolveTargetChannel(message, groupChannel.channelId);
      if (!discordChannel) continue;

      let chunks: string[];
      if (!sourceText.trim()) {
        chunks = [" "];
      } else if (groupChannel.language === detectedLanguage) {
        chunks = [sourceText];
      } else {
        const result = await translateText(sourceText, detectedLanguage, groupChannel.language, message.guild!.id);
        chunks = result.chunks;
      }

      const sentIds: string[] = [];
      for (const [index, chunk] of chunks.entries()) {
        const sentId = await sendWebhookMessage({
          channel: discordChannel,
          content: chunk || " ",
          username,
          avatarURL,
          files: index === 0 && attachmentBuilders.length > 0 ? attachmentBuilders : undefined
        });
        sentIds.push(sentId);
      }

      sentByChannelId.set(groupChannel.channelId, sentIds);
    }

    // Store MessageMaps using the corrected webhook message in the source channel as the new source,
    // so that delete-cascade still works if the user deletes the corrected message.
    const correctedSourceIds = sentByChannelId.get(message.channel.id);
    if (!correctedSourceIds || correctedSourceIds.length === 0) continue;

    for (const target of item.targets) {
      const targetIds = sentByChannelId.get(target.channelId);
      if (!targetIds || targetIds.length === 0) continue;

      await prisma.messageMap.create({
        data: {
          guildId: message.guild!.id,
          groupId: item.groupId,
          sourceChannelId: message.channel.id,
          sourceMessageId: correctedSourceIds[0],
          targetChannelId: target.channelId,
          targetMessageIds: targetIds
        }
      });
    }
  }

  // Delete the original after all corrections are sent. Fails silently if bot lacks permission.
  await message.delete().catch(() => undefined);
}

async function handleMessageUpdate(message: Message | PartialMessage): Promise<void> {
  if (!message.guild || !message.id || !message.channelId) return;

  const maps = await prisma.messageMap.findMany({
    where: {
      guildId: message.guild.id,
      sourceMessageId: message.id,
      sourceChannelId: message.channelId,
      createdAt: { gte: new Date(Date.now() - SYNC_WINDOW_MS) }
    }
  });
  if (maps.length === 0) return;

  const fullMessage = message.partial ? await message.fetch().catch(() => null) : message as Message;
  if (!fullMessage || fullMessage.author.bot || fullMessage.webhookId) return;
  const guild = fullMessage.guild;
  if (!guild) return;

  const sourceText = messageTextWithStickers(fullMessage.content, fullMessage.stickers.values());
  for (const map of maps) {
    const targetChannel = await guild.channels.fetch(map.targetChannelId).catch(() => null);
    if (!targetChannel?.isTextBased()) continue;
    const sourceMembership = await prisma.groupChannel.findFirst({ where: { groupId: map.groupId, channelId: fullMessage.channel.id } });
    const targetMembership = await prisma.groupChannel.findFirst({ where: { groupId: map.groupId, channelId: map.targetChannelId } });
    if (!sourceMembership || !targetMembership) continue;
    const detected = sourceText.trim() ? await detectLanguage(sourceText, guild.id) : null;
    const translated = await translateText(sourceText, detected ?? sourceMembership.language, targetMembership.language, guild.id);
    for (const [index, targetMessageId] of map.targetMessageIds.entries()) {
      await editWebhookMessage(targetChannel as TextChannel | NewsChannel | ThreadChannel, targetMessageId, translated.chunks[index] ?? translated.chunks.at(-1) ?? " ").catch(() => undefined);
    }
  }
}

async function handleMessageDelete(message: Message | PartialMessage): Promise<void> {
  if (!message.guild || !message.id || !message.channelId) return;

  const maps = await prisma.messageMap.findMany({
    where: {
      guildId: message.guild.id,
      sourceMessageId: message.id,
      sourceChannelId: message.channelId,
      createdAt: { gte: new Date(Date.now() - SYNC_WINDOW_MS) }
    }
  });

  for (const map of maps) {
    const targetChannel = await message.guild.channels.fetch(map.targetChannelId).catch(() => null);
    if (!targetChannel?.isTextBased()) continue;
    for (const targetMessageId of map.targetMessageIds) {
      await deleteWebhookMessage(targetChannel as TextChannel | NewsChannel | ThreadChannel, targetMessageId).catch(() => undefined);
    }
  }
}

type TranslationContext = {
  groupId: string;
  source: GroupChannel;
  targets: GroupChannel[];
  threadTargetId?: string;
};

async function resolveTranslationContext(message: Message): Promise<TranslationContext[]> {
  if (message.channel.type === ChannelType.PublicThread || message.channel.type === ChannelType.AnnouncementThread) {
    return resolveThreadContext(message.channel);
  }

  const memberships = await prisma.groupChannel.findMany({
    where: { guildId: message.guildId!, channelId: message.channel.id },
    include: { group: { include: { channels: true } } }
  });

  return memberships.map((membership) => ({
    groupId: membership.groupId,
    source: membership,
    targets: membership.group.channels.filter((channel) => channel.channelId !== membership.channelId)
  }));
}

async function resolveThreadContext(thread: ThreadChannel): Promise<TranslationContext[]> {
  const maps = await prisma.threadMap.findMany({
    where: { guildId: thread.guild.id, sourceThreadId: thread.id }
  });
  if (maps.length === 0) return [];

  const contexts: TranslationContext[] = [];
  for (const map of maps) {
    const source = await prisma.groupChannel.findFirst({ where: { groupId: map.groupId, channelId: thread.parentId ?? "" } });
    const target = await prisma.groupChannel.findFirst({ where: { groupId: map.groupId, channelId: map.targetChannelId } });
    if (source && target) {
      contexts.push({ groupId: map.groupId, source, targets: [target], threadTargetId: map.targetThreadId });
    }
  }
  return contexts;
}

async function resolveTargetChannel(message: Message, targetChannelId: string, threadTargetId?: string): Promise<TextChannel | NewsChannel | ThreadChannel | null> {
  if (threadTargetId) {
    const thread = await message.guild!.channels.fetch(threadTargetId).catch(() => null);
    return thread?.isThread() ? thread : null;
  }

  const channel = await message.guild!.channels.fetch(targetChannelId).catch(() => null);
  return channel && canUseWebhook(channel) ? channel : null;
}
