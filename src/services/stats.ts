import { prisma } from "../db.js";
import { languageName } from "../constants/languages.js";

export async function buildStatsReport(guildId: string): Promise<string> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [total, lastDay, groups, roleUsers, avgAll, avgDay, apiEvents] = await Promise.all([
    prisma.translationStat.aggregate({ where: { guildId }, _sum: { translatedMessages: true } }),
    prisma.translationStat.aggregate({ where: { guildId, createdAt: { gte: since } }, _sum: { translatedMessages: true } }),
    prisma.translationGroup.findMany({ where: { guildId }, include: { channels: true }, orderBy: { name: "asc" } }),
    prisma.roleAssignmentAudit.groupBy({ by: ["userId"], where: { guildId, assigned: true } }),
    prisma.translationStat.aggregate({ where: { guildId }, _avg: { latencyMs: true } }),
    prisma.translationStat.aggregate({ where: { guildId, createdAt: { gte: since } }, _avg: { latencyMs: true } }),
    prisma.translationApiEvent.findMany({ where: { guildId, createdAt: { gte: since } } })
  ]);

  const byPair = await prisma.translationStat.groupBy({
    by: ["sourceLanguage", "targetLanguage"],
    where: { guildId },
    _sum: { translatedMessages: true },
    orderBy: [{ sourceLanguage: "asc" }, { targetLanguage: "asc" }]
  });

  const byChannel = await prisma.translationStat.groupBy({
    by: ["targetChannelId"],
    where: { guildId },
    _sum: { translatedMessages: true }
  });

  const apiErrors = apiEvents.filter((event) => !event.ok).length;
  const apiErrorRate = apiEvents.length === 0 ? "n/a" : `${Math.round((apiErrors / apiEvents.length) * 100)}%`;

  const lines = [
    "**Bot statistics**",
    `Total translated messages: ${total._sum.translatedMessages ?? 0}`,
    `Translated in last 24h: ${lastDay._sum.translatedMessages ?? 0}`,
    `Users assigned language roles: ${roleUsers.length}`,
    `Average response time: ${Math.round(avgAll._avg.latencyMs ?? 0)}ms all time, ${Math.round(avgDay._avg.latencyMs ?? 0)}ms last 24h`,
    `LibreTranslate error rate last 24h: ${apiErrorRate}`,
    "",
    "**Language pairs**",
    byPair.length ? byPair.map((row) => `${languageName(row.sourceLanguage)} -> ${languageName(row.targetLanguage)}: ${row._sum.translatedMessages ?? 0}`).join("\n") : "No translations yet.",
    "",
    "**Channels**",
    byChannel.length ? byChannel.map((row) => `<#${row.targetChannelId}>: ${row._sum.translatedMessages ?? 0}`).join("\n") : "No channel activity yet.",
    "",
    "**Groups**",
    groups.length ? groups.map((group) => `${group.name}: ${group.channels.map((channel) => `<#${channel.channelId}> ${languageName(channel.language)}`).join(", ")}`).join("\n") : "No active groups."
  ];

  return lines.join("\n").slice(0, 2000);
}
