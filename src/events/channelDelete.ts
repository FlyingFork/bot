import { DMChannel, NonThreadGuildBasedChannel } from "discord.js";
import { BotEvent } from "@/types/index";
import db from "@/utils/db";
import { invalidateWebhookCache } from "@/utils/webhook";

const event: BotEvent<"channelDelete"> = {
  name: "channelDelete",

  async execute(channel: DMChannel | NonThreadGuildBasedChannel) {
    if (channel.isDMBased()) return;

    try {
      const record = await db.translationChannel.findUnique({
        where: { channelId: channel.id },
      });

      if (!record) return;

      await db.translationChannel.delete({ where: { id: record.id } });

      // Cascade delete the group if it has no channels left
      const remaining = await db.translationChannel.count({
        where: { groupId: record.groupId },
      });
      if (remaining === 0) {
        await db.translationGroup.delete({ where: { id: record.groupId } });
        console.warn(
          `[channelDelete] Channel ${channel.id} removed and empty group ${record.groupId} dissolved.`,
        );
      } else {
        console.warn(
          `[channelDelete] Channel ${channel.id} removed from group ${record.groupId}. ${remaining} channel(s) remain.`,
        );
      }

      invalidateWebhookCache(channel.id);
    } catch (err) {
      console.error(`[channelDelete] Failed to clean up channel ${channel.id}:`, err);
    }
  },
};

export default event;
