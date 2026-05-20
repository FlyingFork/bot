import type { Guild } from "discord.js";
import { prisma } from "../db.js";
import { logger } from "../logger.js";

export async function setAdminLogChannel(guildId: string, channelId: string): Promise<void> {
  await prisma.guildSettings.upsert({
    where: { guildId },
    create: { guildId, adminLogChannelId: channelId },
    update: { adminLogChannelId: channelId }
  });
}

export async function logToAdmin(guild: Guild | null, message: string): Promise<void> {
  if (!guild) {
    logger.info({ message }, "admin log without guild");
    return;
  }

  const settings = await prisma.guildSettings.findUnique({ where: { guildId: guild.id } });
  if (!settings?.adminLogChannelId) {
    logger.info({ guildId: guild.id, message }, "admin log channel not configured");
    return;
  }

  try {
    const channel = await guild.channels.fetch(settings.adminLogChannelId);
    if (!channel?.isTextBased() || !("send" in channel)) {
      return;
    }
    await channel.send({ content: message.slice(0, 2000) });
  } catch (error) {
    logger.warn({ error, guildId: guild.id }, "failed to write admin log");
  }
}
