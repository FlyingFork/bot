import { Message, PartialMessage, WebhookClient } from "discord.js";
import { BotEvent } from "@/types/index";
import db from "@/utils/db";
import { translateText, isEmojiOrSymbolOnly } from "@/utils/translate";
import { getForwardedMessages } from "@/utils/messageCache";

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

    const resolved = newMessage.partial
      ? await newMessage.fetch().catch((err) => {
          console.error(`[messageUpdate] Failed to fetch partial ${newMessage.id}:`, err);
          return null;
        })
      : newMessage;

    if (!resolved) return;
    if (!resolved.guild) return;

    if (oldMessage.content !== null && oldMessage.content === resolved.content) return;

    const newContent = resolved.content?.trim() ?? "";
    if (!newContent) return;

    const guildId = resolved.guild.id;
    const forwardMap = getForwardedMessages(guildId, resolved.id);
    if (!forwardMap || forwardMap.size === 0) return;

    // Look up the source channel's language
    const sourceRecord = await db.translationChannel.findUnique({
      where: { channelId: resolved.channelId },
      select: { language: true },
    });
    const sourceLang = sourceRecord?.language ?? "en";

    // Collect target channel language codes in one query
    const targetChannelIds = [...forwardMap.keys()];
    const memberRows = await db.translationChannel.findMany({
      where: { channelId: { in: targetChannelIds } },
      select: { channelId: true, language: true, webhookId: true, webhookToken: true },
    });
    const langByChannel = new Map(memberRows.map((r) => [r.channelId, r]));

    const clientCache = new Map<string, WebhookClient>();

    for (const [targetChannelId, webhookMsgIds] of forwardMap.entries()) {
      const record = langByChannel.get(targetChannelId);
      if (!record?.webhookId || !record.webhookToken) {
        console.warn(`[messageUpdate] No webhook record for ${targetChannelId}, skipping.`);
        continue;
      }

      const targetLang = record.language;
      let translatedContent: string;

      if (sourceLang === targetLang || isEmojiOrSymbolOnly(newContent)) {
        translatedContent = newContent;
      } else {
        translatedContent = await translateText(newContent, sourceLang, targetLang).catch(
          (err) => {
            console.error(
              `[messageUpdate] Translation to ${targetLang} failed for ${resolved.id}:`,
              err,
            );
            return newContent;
          },
        );
      }

      // Edits can only update the first chunk (can't expand into new messages)
      const editContent = splitContent(translatedContent)[0];

      let client = clientCache.get(record.webhookId);
      if (!client) {
        client = new WebhookClient({ id: record.webhookId, token: record.webhookToken });
        clientCache.set(record.webhookId, client);
      }

      // Edit the first tracked webhook message; ignore 10008 (already deleted)
      const firstMsgId = webhookMsgIds[0];
      if (firstMsgId) {
        await client.editMessage(firstMsgId, { content: editContent }).catch((err) => {
          if ((err as { code?: number }).code === 10008) {
            console.warn(`[messageUpdate] Webhook message ${firstMsgId} already deleted.`);
          } else {
            console.error(`[messageUpdate] Failed to edit webhook message ${firstMsgId}:`, err);
          }
        });
      }
    }
  },
};

export default event;
