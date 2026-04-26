import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "@/types/index";
import { EMBED_COLOR } from "@/utils/constants";
import { checkLibreTranslateHealth } from "@/utils/translate";
import db from "@/utils/db";

function todayMidnightUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Show bot and translation statistics for this server"),

  requiredRoles: ["R4", "R5"],

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.editReply({ content: "This command can only be used inside a server." });
      return;
    }

    const today = todayMidnightUtc();

    const [groups, totalChannels, statAll, statToday, topChannelRows, health] =
      await Promise.all([
        db.translationGroup.findMany({
          where: { guildId },
          select: { name: true },
          orderBy: { name: "asc" },
        }),
        db.translationChannel.count({ where: { group: { guildId } } }),
        db.translationStat.aggregate({
          _sum: { count: true },
          where: { guildId },
        }),
        db.translationStat.aggregate({
          _sum: { count: true },
          where: { guildId, date: today },
        }),
        db.translationStat.groupBy({
          by: ["channelId"],
          _sum: { count: true },
          where: { guildId },
          orderBy: { _sum: { count: "desc" } },
          take: 1,
        }),
        checkLibreTranslateHealth(),
      ]);

    const totalTranslated = statAll._sum.count ?? 0;
    const todayTranslated = statToday._sum.count ?? 0;

    const mostActiveChannel =
      topChannelRows.length > 0
        ? `<#${topChannelRows[0].channelId}> — ${topChannelRows[0]._sum.count ?? 0} msgs`
        : "N/A";

    const groupNames =
      groups.length > 0
        ? groups.map((g) => `• ${g.name}`).join("\n")
        : "*(none)*";

    const embed = new EmbedBuilder()
      .setTitle("Server Statistics")
      .setColor(EMBED_COLOR)
      .addFields(
        {
          name: `Translation Groups (${groups.length})`,
          value: groupNames.slice(0, 1024),
          inline: false,
        },
        {
          name: "Channels Enrolled",
          value: String(totalChannels),
          inline: true,
        },
        {
          name: "Messages Translated (all-time)",
          value: String(totalTranslated),
          inline: true,
        },
        {
          name: "Messages Translated (today)",
          value: String(todayTranslated),
          inline: true,
        },
        {
          name: "Most Active Channel",
          value: mostActiveChannel,
          inline: false,
        },
        {
          name: "Bot Uptime",
          value: formatUptime(Math.floor(process.uptime())),
          inline: true,
        },
        {
          name: "LibreTranslate",
          value: health.ok ? `✅ Online (${health.latencyMs}ms)` : `❌ Offline`,
          inline: true,
        },
      );

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
