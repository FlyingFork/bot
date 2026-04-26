import { Message, PartialMessage, WebhookClient } from "discord.js";
import { BotEvent } from "@/types/index";
import db from "@/utils/db";
import { getForwardedMessages, deleteForwardedMessages } from "@/utils/messageCache";

const event: BotEvent<"messageDelete"> = {
  name: "messageDelete",

  async execute(message: Message | PartialMessage) {
    const guildId = message.guildId;
    if (!guildId) return;

    const forwardMap = getForwardedMessages(guildId, message.id);
    if (!forwardMap || forwardMap.size === 0) return;

    const targetChannelIds = [...forwardMap.keys()];
    const webhookRows = await db.translationChannel.findMany({
      where: { channelId: { in: targetChannelIds } },
      select: { channelId: true, webhookId: true, webhookToken: true },
    });

    const webhookByChannel = new Map(
      webhookRows
        .filter((r) => r.webhookId && r.webhookToken)
        .map((r) => [r.channelId, r]),
    );

    const clientCache = new Map<string, WebhookClient>();

    for (const [targetChannelId, webhookMsgIds] of forwardMap.entries()) {
      const record = webhookByChannel.get(targetChannelId);
      if (!record?.webhookId || !record.webhookToken) {
        console.warn(`[messageDelete] No webhook record for ${targetChannelId}, skipping.`);
        continue;
      }

      let client = clientCache.get(record.webhookId);
      if (!client) {
        client = new WebhookClient({ id: record.webhookId, token: record.webhookToken });
        clientCache.set(record.webhookId, client);
      }

      for (const msgId of webhookMsgIds) {
        await client.deleteMessage(msgId).catch((err) => {
          if ((err as { code?: number }).code === 10008) {
            // Message already deleted — expected, not an error
          } else {
            console.error(`[messageDelete] Failed to delete webhook message ${msgId}:`, err);
          }
        });
      }
    }

    deleteForwardedMessages(guildId, message.id);
  },
};

export default event;
