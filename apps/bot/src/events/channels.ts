import type { Client } from "discord.js";
import { prisma } from "../db.js";
import { logToAdmin } from "../services/adminLog.js";
import { logger } from "../logger.js";

export function registerChannelEvents(client: Client): void {
  client.on("channelDelete", async (channel) => {
    if (!("guild" in channel)) return;
    const guild = channel.guild;

    try {
      const memberships = await prisma.groupChannel.findMany({
        where: { guildId: guild.id, channelId: channel.id },
        include: { group: true }
      });

      for (const membership of memberships) {
        await prisma.groupChannel.delete({ where: { id: membership.id } });
        const remaining = await prisma.groupChannel.count({ where: { groupId: membership.groupId } });
        if (remaining <= 1) {
          await prisma.translationGroup.delete({ where: { id: membership.groupId } }).catch(() => undefined);
        }
      }

      await prisma.managedWebhook.deleteMany({ where: { guildId: guild.id, channelId: channel.id } });
      if (memberships.length > 0) {
        await logToAdmin(guild, `Deleted Discord channel ${channel.id} was removed from ${memberships.length} translation group membership(s).`);
      }
    } catch (error) {
      logger.error({ error }, "channelDelete cleanup failed");
      await logToAdmin(guild, `Channel deletion cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
}
