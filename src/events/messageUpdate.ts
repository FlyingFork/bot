import { Message, PartialMessage, WebhookClient } from "discord.js";
import { BotEvent } from "@/types/index";
import db from "@/utils/db";
import { translateText } from "@/utils/translate";

const event: BotEvent<"messageUpdate"> = {
  name: "messageUpdate",

  async execute(
    oldMessage: Message | PartialMessage,
    newMessage: Message | PartialMessage,
  ) {
    if (newMessage.author?.bot || newMessage.webhookId) return;

    // Resolve partial to get .content. If fetch fails, abort silently.
    const resolved = newMessage.partial
      ? await newMessage.fetch().catch((err) => {
          console.error(
            `[messageUpdate] Failed to fetch partial message ${newMessage.id}:`,
            err,
          );
          return null;
        })
      : newMessage;

    if (!resolved) return;

    // Skip embed unfurls and other non-content updates.
    // oldMessage.content === null means uncached — treat as a change so real
    // edits on previously uncached messages are not silently skipped.
    if (oldMessage.content !== null && oldMessage.content === resolved.content) {
      return;
    }

    const newContent = resolved.content ?? "";
    if (!newContent.trim()) return;

    const records = await db.forwardedMessage.findMany({
      where: { sourceMessageId: resolved.id },
    });

    if (records.length === 0) return;

    const targetChannelIds = [...new Set(records.map((r) => r.targetChannelId))];

    const [webhookRows, memberRows] = await Promise.all([
      db.channelWebhook.findMany({
        where: { channelId: { in: targetChannelIds } },
      }),
      db.channelGroupMember.findMany({
        where: { channelId: { in: targetChannelIds } },
      }),
    ]);

    const webhookByChannel = new Map(
      webhookRows.map((row) => [row.channelId, row]),
    );
    const langByChannel = new Map(
      memberRows.map((row) => [row.channelId, row.languageCode]),
    );

    for (const record of records) {
      const webhookRow = webhookByChannel.get(record.targetChannelId);
      const targetLang = langByChannel.get(record.targetChannelId);

      if (!webhookRow) {
        console.warn(
          `[messageUpdate] No webhook record for channel ${record.targetChannelId}, skipping.`,
        );
        continue;
      }
      if (!targetLang) {
        console.warn(
          `[messageUpdate] No language code for channel ${record.targetChannelId}, skipping.`,
        );
        continue;
      }

      const translatedText = await translateText(newContent, targetLang).catch(
        (err) => {
          console.error(
            `[messageUpdate] Translation to ${targetLang} failed for message ${resolved.id}:`,
            err,
          );
          return newContent;
        },
      );

      const client = new WebhookClient({
        id: webhookRow.webhookId,
        token: webhookRow.webhookToken,
      });

      await client
        .editMessage(record.webhookMessageId, { content: translatedText })
        .catch((err) =>
          console.error(
            `[messageUpdate] Failed to edit webhook message ${record.webhookMessageId} in channel ${record.targetChannelId}:`,
            err,
          ),
        );
    }
  },
};

export default event;
