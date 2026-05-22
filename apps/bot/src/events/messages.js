import { ChannelType } from "discord.js";
import { prisma } from "../db.js";
import { logger } from "../logger.js";
import { detectLanguage, translateText } from "../services/libreTranslate.js";
import { logToAdmin } from "../services/adminLog.js";
import { messageTextWithStickers } from "../services/translationFormatter.js";
import { canUseWebhook, deleteWebhookMessage, editWebhookMessage, sendWebhookMessage } from "../services/webhooks.js";
const cooldowns = new Map();
const COOLDOWN_MS = 2000;
const SYNC_WINDOW_MS = 15 * 60 * 1000;
export function registerMessageEvents(client) {
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
export async function translateMessage(message, options = {}) {
    if (!message.guild || message.author.bot || message.webhookId)
        return;
    const context = await resolveTranslationContext(message);
    if (context.length === 0)
        return;
    const existing = await prisma.messageMap.count({
        where: {
            guildId: message.guild.id,
            sourceChannelId: message.channel.id,
            sourceMessageId: message.id
        }
    });
    if (existing > 0)
        return;
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
    const files = [...message.attachments.values()].map((attachment) => attachment.url);
    const username = message.member?.displayName ?? message.author.username;
    const avatarURL = message.member?.displayAvatarURL() ?? message.author.displayAvatarURL();
    for (const item of context) {
        const detected = sourceText.trim() ? await detectLanguage(sourceText, message.guild.id) : null;
        const sourceLanguage = detected ?? item.source.language;
        for (const target of item.targets) {
            const targetChannel = await resolveTargetChannel(message, target.channelId, item.threadTargetId);
            if (!targetChannel)
                continue;
            const translated = sourceText.trim()
                ? await translateText(sourceText, sourceLanguage, target.language, message.guild.id)
                : { chunks: [""], latencyMs: 0 };
            const sentIds = [];
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
async function handleMessageUpdate(message) {
    if (!message.guild || !message.id || !message.channelId)
        return;
    const maps = await prisma.messageMap.findMany({
        where: {
            guildId: message.guild.id,
            sourceMessageId: message.id,
            sourceChannelId: message.channelId,
            createdAt: { gte: new Date(Date.now() - SYNC_WINDOW_MS) }
        }
    });
    if (maps.length === 0)
        return;
    const fullMessage = message.partial ? await message.fetch().catch(() => null) : message;
    if (!fullMessage || fullMessage.author.bot || fullMessage.webhookId)
        return;
    const guild = fullMessage.guild;
    if (!guild)
        return;
    const sourceText = messageTextWithStickers(fullMessage.content, fullMessage.stickers.values());
    for (const map of maps) {
        const targetChannel = await guild.channels.fetch(map.targetChannelId).catch(() => null);
        if (!targetChannel?.isTextBased())
            continue;
        const sourceMembership = await prisma.groupChannel.findFirst({ where: { groupId: map.groupId, channelId: fullMessage.channel.id } });
        const targetMembership = await prisma.groupChannel.findFirst({ where: { groupId: map.groupId, channelId: map.targetChannelId } });
        if (!sourceMembership || !targetMembership)
            continue;
        const detected = sourceText.trim() ? await detectLanguage(sourceText, guild.id) : null;
        const translated = await translateText(sourceText, detected ?? sourceMembership.language, targetMembership.language, guild.id);
        for (const [index, targetMessageId] of map.targetMessageIds.entries()) {
            await editWebhookMessage(targetChannel, targetMessageId, translated.chunks[index] ?? translated.chunks.at(-1) ?? " ").catch(() => undefined);
        }
    }
}
async function handleMessageDelete(message) {
    if (!message.guild || !message.id || !message.channelId)
        return;
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
        if (!targetChannel?.isTextBased())
            continue;
        for (const targetMessageId of map.targetMessageIds) {
            await deleteWebhookMessage(targetChannel, targetMessageId).catch(() => undefined);
        }
    }
}
async function resolveTranslationContext(message) {
    if (message.channel.type === ChannelType.PublicThread || message.channel.type === ChannelType.AnnouncementThread) {
        return resolveThreadContext(message.channel);
    }
    const memberships = await prisma.groupChannel.findMany({
        where: { guildId: message.guildId, channelId: message.channel.id },
        include: { group: { include: { channels: true } } }
    });
    return memberships.map((membership) => ({
        groupId: membership.groupId,
        source: membership,
        targets: membership.group.channels.filter((channel) => channel.channelId !== membership.channelId)
    }));
}
async function resolveThreadContext(thread) {
    const maps = await prisma.threadMap.findMany({
        where: { guildId: thread.guild.id, sourceThreadId: thread.id }
    });
    if (maps.length === 0)
        return [];
    const contexts = [];
    for (const map of maps) {
        const source = await prisma.groupChannel.findFirst({ where: { groupId: map.groupId, channelId: thread.parentId ?? "" } });
        const target = await prisma.groupChannel.findFirst({ where: { groupId: map.groupId, channelId: map.targetChannelId } });
        if (source && target) {
            contexts.push({ groupId: map.groupId, source, targets: [target], threadTargetId: map.targetThreadId });
        }
    }
    return contexts;
}
async function resolveTargetChannel(message, targetChannelId, threadTargetId) {
    if (threadTargetId) {
        const thread = await message.guild.channels.fetch(threadTargetId).catch(() => null);
        return thread?.isThread() ? thread : null;
    }
    const channel = await message.guild.channels.fetch(targetChannelId).catch(() => null);
    return channel && canUseWebhook(channel) ? channel : null;
}
