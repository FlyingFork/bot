import { Message, PartialMessage, WebhookClient } from "discord.js";
import { BotEvent } from "@/types/index";
import db from "@/utils/db";

const event: BotEvent<"messageDelete"> = {
  name: "messageDelete",

  async execute(message: Message | PartialMessage) {
    // Partials only guarantee .id — that is all we need for the DB lookup.
    const records = await db.forwardedMessage.findMany({
      where: { sourceMessageId: message.id },
    });

    if (records.length === 0) return;

    const targetChannelIds = [...new Set(records.map((r) => r.targetChannelId))];
    const webhookRows = await db.channelWebhook.findMany({
      where: { channelId: { in: targetChannelIds } },
    });

    const webhookByChannel = new Map(
      webhookRows.map((row) => [row.channelId, row]),
    );

    for (const record of records) {
      const webhookRow = webhookByChannel.get(record.targetChannelId);
      if (!webhookRow) {
        console.warn(
          `[messageDelete] No webhook record for channel ${record.targetChannelId}, skipping.`,
        );
        continue;
      }

      const client = new WebhookClient({
        id: webhookRow.webhookId,
        token: webhookRow.webhookToken,
      });

      await client
        .deleteMessage(record.webhookMessageId)
        .catch((err) =>
          console.error(
            `[messageDelete] Failed to delete webhook message ${record.webhookMessageId} in channel ${record.targetChannelId}:`,
            err,
          ),
        );
    }

    await db.forwardedMessage
      .deleteMany({ where: { sourceMessageId: message.id } })
      .catch((err) =>
        console.error(
          `[messageDelete] Failed to clean up ForwardedMessage records for ${message.id}:`,
          err,
        ),
      );
  },
};

export default event;
