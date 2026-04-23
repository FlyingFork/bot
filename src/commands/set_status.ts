import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { Command } from "@/types/index";
import {
  parseStatusActivityType,
  parseStatusCountdown,
  parseStatusLanguages,
  restartStatusScheduler,
  upsertStatusConfig,
} from "@/utils/status";
import { isLanguageSupported } from "@/utils/translate";

function normalizeInterval(value: string): number {
  if (!value.trim()) return 30;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Interval must be a positive integer.");
  }

  return Math.max(5, parsed);
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("set_status")
    .setDescription("Configure the bot presence and language rotation"),
  requiredRoles: ["R5"],

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
      await interaction.reply({
        content: "This command can only be used inside a server.",
        ephemeral: true,
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId("set-status-modal")
      .setTitle("Set Bot Status");

    const activityTypeInput = new TextInputBuilder()
      .setCustomId("activityType")
      .setLabel("Activity type")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder(
        "Playing, Streaming, Listening, Watching, Competing, Custom",
      )
      .setRequired(true);

    const messageInput = new TextInputBuilder()
      .setCustomId("message")
      .setLabel("Base message")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("for Arcadia in")
      .setRequired(true);

    const countdownInput = new TextInputBuilder()
      .setCustomId("countdown")
      .setLabel("Countdown target UTC date (optional)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("2026-05-01 18:00 or 2026-05-01T18:00:00Z")
      .setRequired(false);

    const languagesInput = new TextInputBuilder()
      .setCustomId("languages")
      .setLabel("Languages (comma-separated)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("en, ru, de")
      .setRequired(true);

    const intervalInput = new TextInputBuilder()
      .setCustomId("interval")
      .setLabel("Translation interval seconds (default 30)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("30")
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(activityTypeInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(messageInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(countdownInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(languagesInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(intervalInput),
    );

    await interaction.showModal(modal);

    const submission = await interaction
      .awaitModalSubmit({
        time: 5 * 60_000,
        filter: (i) =>
          i.customId === "set-status-modal" &&
          i.user.id === interaction.user.id,
      })
      .catch(() => null);

    if (!submission) return;

    await submission.deferReply({ ephemeral: true });

    const activityTypeRaw = submission.fields.getTextInputValue("activityType");
    const message = submission.fields.getTextInputValue("message").trim();
    const countdownRaw = submission.fields.getTextInputValue("countdown");
    const languagesRaw = submission.fields.getTextInputValue("languages");
    const intervalRaw = submission.fields.getTextInputValue("interval");

    const activityType = parseStatusActivityType(activityTypeRaw);
    if (!activityType) {
      await submission.editReply({
        content:
          "Invalid activity type. Use Playing, Streaming, Listening, Watching, Competing, or Custom.",
      });
      return;
    }

    if (!message) {
      await submission.editReply({
        content: "Base message cannot be empty.",
      });
      return;
    }

    const countdownTarget = parseStatusCountdown(countdownRaw);
    if (countdownRaw.trim() && !countdownTarget) {
      await submission.editReply({
        content:
          "Countdown target is invalid. Use a UTC date like `2026-05-01 18:00` or `2026-05-01T18:00:00Z`.",
      });
      return;
    }

    const requestedLanguages = languagesRaw
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);
    const unsupportedLanguages = requestedLanguages.filter(
      (entry) => !isLanguageSupported(entry),
    );

    if (unsupportedLanguages.length > 0) {
      await submission.editReply({
        content: `Unsupported language code(s): ${unsupportedLanguages.join(", ")}. Supported languages right now are \`en\`, \`ru\`, and \`de\`.`,
      });
      return;
    }

    const languageCodes = parseStatusLanguages(languagesRaw);
    if (languageCodes.length === 0) {
      await submission.editReply({
        content:
          "At least one supported language is required. Supported languages right now are `en`, `ru`, and `de`.",
      });
      return;
    }

    let intervalSeconds: number;
    try {
      intervalSeconds = normalizeInterval(intervalRaw);
    } catch (error) {
      await submission.editReply({
        content: (error as Error).message,
      });
      return;
    }

    await upsertStatusConfig({
      enabled: true,
      activityType: activityTypeRaw.trim(),
      message,
      countdownTargetAt: countdownTarget,
      languageCodes,
      translationIntervalSeconds: intervalSeconds,
      currentLanguageIndex: 0,
    });

    await restartStatusScheduler(
      interaction.client as typeof interaction.client & {
        user: NonNullable<typeof interaction.client.user>;
      },
    );

    await submission.editReply({
      content:
        `Status updated. Activity: **${activityTypeRaw.trim()}**. ` +
        `Languages: **${languageCodes.join(", ")}**. ` +
        `Interval: **${intervalSeconds}s**.` +
        (countdownTarget
          ? ` Countdown target: **${countdownTarget.toISOString()}**.`
          : ""),
    });
  },
};

export default command;
