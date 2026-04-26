import { Message, TextChannel, ThreadChannel } from "discord.js";
import { BotEvent } from "@/types/index";
import db from "@/utils/db";
import { isOwnWebhook } from "@/utils/webhook";
import {
  getMessageChannelContext,
  processTranslationMessage,
} from "@/utils/messageProcessor";

// ── Event ─────────────────────────────────────────────────────────────────────

const event: BotEvent<"messageCreate"> = {
  name: "messageCreate",

  async execute(message: Message) {
    // ── Pre-flight ────────────────────────────────────────────────────────────
    if (message.author.bot) return;
    if (message.webhookId && isOwnWebhook(message.webhookId)) return;
    if (message.system) return;
    if (!message.guild) return;

    if (
      !(message.channel instanceof ThreadChannel) &&
      !(message.channel instanceof TextChannel)
    ) {
      return;
    }

    const channelContext = getMessageChannelContext(message);
    if (!channelContext) return;

    // ── DB lookup ─────────────────────────────────────────────────────────────
    const sourceRecord = await db.translationChannel.findUnique({
      where: { channelId: channelContext.effectiveChannelId },
    });
    if (!sourceRecord) return;

    const group = await db.translationGroup.findUnique({
      where: { id: sourceRecord.groupId },
      include: { channels: true },
    });
    if (!group) return;

    await processTranslationMessage(message, sourceRecord, group, {
      contextTag: "messageCreate",
      skipRateLimit: false,
      allowMismatchDelete: true,
      notifyTranslationFailureToAuthor: true,
      channelContext,
    });
  },
};

export default event;
