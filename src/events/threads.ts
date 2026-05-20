import { ChannelType, type Client, type Message, type NewsChannel, type TextChannel, type ThreadChannel } from "discord.js";
import { prisma } from "../db.js";
import { detectLanguage, translateText } from "../services/libreTranslate.js";
import { logToAdmin } from "../services/adminLog.js";
import { logger } from "../logger.js";
import { translateMessage } from "./messages.js";

export function registerThreadEvents(client: Client): void {
  client.on("threadCreate", async (thread) => {
    if (thread.ownerId === client.user?.id) return;
    await handleThreadCreate(thread).catch(async (error) => {
      logger.error({ error }, "threadCreate failed");
      await logToAdmin(thread.guild, `Thread translation error: ${error instanceof Error ? error.message : String(error)}`);
    });
  });

  client.on("threadUpdate", async (_oldThread, newThread) => {
    await handleThreadUpdate(newThread).catch(async (error) => {
      logger.error({ error }, "threadUpdate failed");
      await logToAdmin(newThread.guild, `Thread update sync error: ${error instanceof Error ? error.message : String(error)}`);
    });
  });

  client.on("threadDelete", async (thread) => {
    await handleThreadDelete(thread).catch(async (error) => {
      logger.error({ error }, "threadDelete failed");
      await logToAdmin(thread.guild, `Thread delete sync error: ${error instanceof Error ? error.message : String(error)}`);
    });
  });
}

async function handleThreadCreate(thread: ThreadChannel): Promise<void> {
  if (!thread.guild || !thread.parentId || thread.type === ChannelType.PrivateThread || thread.parent?.nsfw) return;
  if (thread.parent?.type === ChannelType.GuildForum || thread.parent?.type === ChannelType.GuildMedia) return;

  const memberships = await prisma.groupChannel.findMany({
    where: { guildId: thread.guild.id, channelId: thread.parentId },
    include: { group: { include: { channels: true } } }
  });
  if (memberships.length === 0) return;

  for (const membership of memberships) {
    const detected = await detectLanguage(thread.name, thread.guild.id);
    for (const target of membership.group.channels.filter((channel) => channel.channelId !== membership.channelId)) {
      const targetParent = await thread.guild.channels.fetch(target.channelId).catch(() => null);
      if (!targetParent || !("threads" in targetParent)) continue;

      const translatedName = await translateText(thread.name, detected ?? membership.language, target.language, thread.guild.id);
      const created = await (targetParent as TextChannel | NewsChannel).threads.create({
        name: translatedName.chunks.join(" ").slice(0, 100),
        autoArchiveDuration: thread.autoArchiveDuration ?? 1440,
        reason: "Translated thread mirror"
      });

      await prisma.threadMap.create({
        data: {
          guildId: thread.guild.id,
          groupId: membership.groupId,
          sourceThreadId: thread.id,
          sourceChannelId: thread.parentId,
          targetThreadId: created.id,
          targetChannelId: target.channelId,
          language: target.language
        }
      });
    }
  }

  await backfillInitialThreadMessages(thread);
}

async function handleThreadUpdate(thread: ThreadChannel): Promise<void> {
  if (!thread.guild) return;

  const maps = await prisma.threadMap.findMany({ where: { guildId: thread.guild.id, sourceThreadId: thread.id } });
  if (maps.length === 0) return;

  for (const map of maps) {
    const targetThread = await thread.guild.channels.fetch(map.targetThreadId).catch(() => null);
    if (!targetThread?.isThread()) continue;

    const source = await prisma.groupChannel.findFirst({ where: { groupId: map.groupId, channelId: map.sourceChannelId } });
    if (source) {
      const translatedName = await translateText(thread.name, source.language, map.language, thread.guild.id);
      await targetThread.setName(translatedName.chunks.join(" ").slice(0, 100), "Translated thread title update").catch(() => undefined);
    }
    if (typeof thread.archived === "boolean") {
      await targetThread.setArchived(thread.archived, "Translated thread archive sync").catch(() => undefined);
    }
  }
}

async function handleThreadDelete(thread: ThreadChannel): Promise<void> {
  if (!thread.guild) return;

  const maps = await prisma.threadMap.findMany({ where: { guildId: thread.guild.id, sourceThreadId: thread.id } });
  for (const map of maps) {
    const targetThread = await thread.guild.channels.fetch(map.targetThreadId).catch(() => null);
    if (targetThread?.isThread()) {
      await targetThread.delete("Translated source thread deleted").catch(() => undefined);
    }
  }
  await prisma.threadMap.deleteMany({ where: { guildId: thread.guild.id, sourceThreadId: thread.id } });
}

async function backfillInitialThreadMessages(thread: ThreadChannel): Promise<void> {
  await delay(1000);

  const messages = await thread.messages.fetch({ limit: 10 }).catch(() => null);
  const fetchedMessages = messages ? [...messages.values()] : [];
  const starterMessage = await thread.fetchStarterMessage().catch(() => null);
  const candidates = uniqueMessages([
    ...fetchedMessages,
    ...(starterMessage && starterMessage.channelId === thread.id ? [starterMessage] : [])
  ]);

  candidates.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

  for (const message of candidates) {
    if (message.author.bot || message.webhookId) continue;
    await translateMessage(message as Message, { bypassCooldown: true });
  }
}

function uniqueMessages(messages: Message[]): Message[] {
  return [...new Map(messages.map((message) => [message.id, message])).values()];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
