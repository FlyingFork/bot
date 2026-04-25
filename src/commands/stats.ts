import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
} from "discord.js";
import { Command } from "@/types/index";
import { EMBED_COLOR } from "@/utils/constants";
import db from "@/utils/db";

type WindowKey = "1h" | "24h" | "7d" | "all";

type EventRow = {
  sourceChannelId: string;
  targetChannelId: string;
  sourceMessageId: string;
  sourceLanguage: string;
  targetLanguage: string;
  kind: "FORWARDED" | "SOURCE_CORRECTION";
};

const WINDOW_LABELS: Record<WindowKey, string> = {
  "1h": "Last hour",
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  all: "All time",
};

// E4: cap the number of rows loaded into memory
const MAX_EVENTS = 10_000;

function resolveWindow(windowKey: WindowKey): {
  since: Date | null;
  label: string;
} {
  const now = new Date();

  switch (windowKey) {
    case "1h":
      return {
        since: new Date(now.getTime() - 60 * 60 * 1000),
        label: WINDOW_LABELS[windowKey],
      };
    case "24h":
      return {
        since: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        label: WINDOW_LABELS[windowKey],
      };
    case "7d":
      return {
        since: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        label: WINDOW_LABELS[windowKey],
      };
    case "all":
    default:
      return { since: null, label: WINDOW_LABELS.all };
  }
}

function formatTopEntries(
  entries: Array<[string, number]>,
  emptyLabel: string,
): string {
  if (entries.length === 0) return emptyLabel;

  return entries.map(([key, count]) => `${key} — ${count}`).join("\n");
}

function tally(values: string[]): Array<[string, number]> {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function prettyLanguage(value: string): string {
  return value === "unknown" ? "unknown" : `\`${value}\``;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Show translation activity statistics")
    .addStringOption((option) =>
      option
        .setName("window")
        .setDescription("Time window to inspect")
        .addChoices(
          { name: "Last hour", value: "1h" },
          { name: "Last 24 hours", value: "24h" },
          { name: "Last 7 days", value: "7d" },
          { name: "All time", value: "all" },
        ),
    ) as SlashCommandBuilder,
  requiredRoles: [],

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    if (!interaction.guildId) {
      await interaction.editReply({
        content: "This command can only be used inside a server.",
      });
      return;
    }

    const windowValue = (interaction.options.getString("window") ??
      "24h") as WindowKey;
    const { since, label } = resolveWindow(windowValue);

    const events = (await db.translationEvent.findMany({
      where: {
        guildId: interaction.guildId,
        ...(since ? { createdAt: { gte: since } } : {}),
      },
      select: {
        sourceChannelId: true,
        targetChannelId: true,
        sourceMessageId: true,
        sourceLanguage: true,
        targetLanguage: true,
        kind: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: MAX_EVENTS,
    })) as EventRow[];

    const capped = events.length === MAX_EVENTS;

    const total = events.length;
    const forwarded = events.filter(
      (event) => event.kind === "FORWARDED",
    ).length;
    const sourceCorrections = events.filter(
      (event) => event.kind === "SOURCE_CORRECTION",
    ).length;
    const uniqueSourceChannels = new Set(
      events.map((event) => event.sourceChannelId),
    ).size;
    const uniqueTargetChannels = new Set(
      events.map((event) => event.targetChannelId),
    ).size;
    const uniqueOriginalMessages = new Set(
      events.map((event) => event.sourceMessageId),
    ).size;
    const avgPerHour = since
      ? total / Math.max((Date.now() - since.getTime()) / (60 * 60 * 1000), 1)
      : 0;

    const sourceLanguageBreakdown = tally(
      events.map((event) => event.sourceLanguage),
    );
    const targetLanguageBreakdown = tally(
      events.map((event) => event.targetLanguage),
    );
    const sourceChannelBreakdown = tally(
      events.map((event) => `<#${event.sourceChannelId}>`),
    );

    // D3: note that deleted channels will render as #deleted-channel in Discord
    const footerParts = [
      "Counts reflect translated sends. One source message can generate multiple events when forwarded to more than one channel.",
      "Channels removed since logging will appear as #deleted-channel.",
    ];
    if (capped) footerParts.push(`Results capped at ${MAX_EVENTS.toLocaleString()} rows.`);

    const embed = new EmbedBuilder()
      .setTitle("Translation Stats")
      .setColor(EMBED_COLOR)
      .setDescription(
        `${label}${since ? ` • since ${since.toISOString()}` : ""}`,
      )
      .setFooter({ text: footerParts.join(" ") })
      .addFields(
        {
          name: "Volume",
          value: [
            `Translated sends: **${total}**`,
            `Unique source messages: **${uniqueOriginalMessages}**`,
            `Forwarded copies: **${forwarded}**`,
            `Source corrections: **${sourceCorrections}**`,
            since
              ? `Average per hour: **${avgPerHour.toFixed(2)}**`
              : `Average per hour: **n/a**`,
          ].join("\n"),
          inline: false,
        },
        {
          name: "Channels",
          value: [
            `Unique source channels: **${uniqueSourceChannels}**`,
            `Unique target channels: **${uniqueTargetChannels}**`,
          ].join("\n"),
          inline: true,
        },
        {
          name: "Top source languages",
          value: formatTopEntries(
            sourceLanguageBreakdown
              .slice(0, 3)
              .map(([lang, count]) => [prettyLanguage(lang), count]),
            "No translated messages in this window.",
          ),
          inline: true,
        },
        {
          name: "Top target languages",
          value: formatTopEntries(
            targetLanguageBreakdown
              .slice(0, 3)
              .map(([lang, count]) => [prettyLanguage(lang), count]),
            "No translated messages in this window.",
          ),
          inline: true,
        },
        {
          name: "Most active source channels",
          value: formatTopEntries(
            sourceChannelBreakdown.slice(0, 3),
            "No translated messages in this window.",
          ),
          inline: false,
        },
      );

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
