import { ChannelType, WebhookClient } from "discord.js";
import { prisma } from "../db.js";
import { logger } from "../logger.js";
export async function ensureManagedWebhook(channel) {
    const existing = await prisma.managedWebhook.findUnique({
        where: { guildId_channelId: { guildId: channel.guild.id, channelId: channel.id } }
    });
    if (existing) {
        return new WebhookClient({ id: existing.webhookId, token: existing.token });
    }
    const webhook = await channel.createWebhook({
        name: "Translation Relay",
        reason: "Translation bot managed webhook"
    });
    if (!webhook.token) {
        throw new Error("Discord did not return a webhook token");
    }
    await prisma.managedWebhook.create({
        data: {
            guildId: channel.guild.id,
            channelId: channel.id,
            webhookId: webhook.id,
            token: webhook.token
        }
    });
    return new WebhookClient({ id: webhook.id, token: webhook.token });
}
export async function cleanupWebhookIfUnused(guildId, channelId) {
    const remaining = await prisma.groupChannel.count({ where: { guildId, channelId } });
    if (remaining > 0) {
        return;
    }
    const record = await prisma.managedWebhook.findUnique({
        where: { guildId_channelId: { guildId, channelId } }
    });
    if (!record) {
        return;
    }
    try {
        await new WebhookClient({ id: record.webhookId, token: record.token }).delete("Translation channel no longer linked");
    }
    catch (error) {
        logger.warn({ error, guildId, channelId }, "failed to delete managed webhook");
    }
    await prisma.managedWebhook.delete({ where: { guildId_channelId: { guildId, channelId } } });
}
export function canUseWebhook(channel) {
    return typeof channel === "object"
        && channel !== null
        && "type" in channel
        && (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement);
}
export async function sendWebhookMessage(params) {
    const parent = params.channel.isThread() ? params.channel.parent : params.channel;
    if (!parent || !canUseWebhook(parent)) {
        throw new Error("Target channel cannot use webhooks");
    }
    const webhook = await ensureManagedWebhook(parent);
    const sent = await webhook.send({
        content: params.content,
        username: params.username,
        avatarURL: params.avatarURL,
        threadId: params.channel.isThread() ? params.channel.id : undefined,
        files: params.files,
        allowedMentions: { parse: ["users", "roles", "everyone"] },
        ...(params.replyMessageId ? { flags: undefined } : {})
    });
    return Array.isArray(sent) ? sent[0].id : sent.id;
}
export async function editWebhookMessage(channel, messageId, content) {
    const parent = channel.isThread() ? channel.parent : channel;
    if (!parent || !canUseWebhook(parent)) {
        throw new Error("Target channel cannot use webhooks");
    }
    const webhook = await ensureManagedWebhook(parent);
    await webhook.editMessage(messageId, {
        content,
        threadId: channel.isThread() ? channel.id : undefined
    });
}
export async function deleteWebhookMessage(channel, messageId) {
    const parent = channel.isThread() ? channel.parent : channel;
    if (!parent || !canUseWebhook(parent)) {
        throw new Error("Target channel cannot use webhooks");
    }
    const webhook = await ensureManagedWebhook(parent);
    await webhook.deleteMessage(messageId, channel.isThread() ? channel.id : undefined);
}
