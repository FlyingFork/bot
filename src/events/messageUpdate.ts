import { Message, PartialMessage, WebhookClient } from "discord.js";
import { BotEvent } from "@/types/index";
import db from "@/utils/db";
import { translateText } from "@/utils/translate";

/** Splits text into chunks that fit within Discord's 2000-char message limit. */
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

    // M1: reuse WebhookClient instances within this handler execution
    const webhookClientCache = new Map<string, WebhookClient>();

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

      // E1: edits can't expand into multiple messages, so use only the first chunk
      const editContent = splitContent(translatedText)[0];

      let client = webhookClientCache.get(webhookRow.webhookId);
      if (!client) {
        client = new WebhookClient({
          id: webhookRow.webhookId,
          token: webhookRow.webhookToken,
        });
        webhookClientCache.set(webhookRow.webhookId, client);
      }

      await client
        .editMessage(record.webhookMessageId, { content: editContent })
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
