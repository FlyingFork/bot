import {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  TextChannel,
} from "discord.js";
import { Command } from "@/types/index";
import db from "@/utils/db";
import { isLanguageSupported } from "@/utils/translate";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("link-channels")
    .setDescription("Link channels into a translation group"),
  requiredRoles: ["R4", "R5"],

  async execute(interaction: ChatInputCommandInteraction) {
    const modal = new ModalBuilder()
      .setCustomId("link-channels-modal")
      .setTitle("Link Translation Channels");

    const pairsInput = new TextInputBuilder()
      .setCustomId("pairs")
      .setLabel("Channel ID : Language Code (one per line)")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder(
        "123456789012345678:en\n987654321098765432:ru\n876543210987654321:de",
      )
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(pairsInput),
    );
    await interaction.showModal(modal);

    const submission = await interaction
      .awaitModalSubmit({
        time: 5 * 60_000,
        filter: (i) =>
          i.customId === "link-channels-modal" &&
          i.user.id === interaction.user.id,
      })
      .catch(() => null);

    if (!submission) return;

    await submission.deferReply({ ephemeral: true });

    const raw = submission.fields.getTextInputValue("pairs");
    const lines = raw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    // ── Parse and validate each line ─────────────────────────────────────────
    const errors: string[] = [];
    const validated: { channelId: string; lang: string }[] = [];

    for (const line of lines) {
      const [channelId, lang] = line.split(":").map((s) => s.trim());

      if (!channelId || !lang) {
        errors.push(`"${line}" — must be in the format channelId:languageCode`);
        continue;
      }

      // Verify the channel exists and is a text channel.
      const channel = interaction.guild?.channels.cache.get(channelId);
      if (!channel || !(channel instanceof TextChannel)) {
        errors.push(`${channelId} — not a valid text channel in this guild`);
        continue;
      }

      if (!isLanguageSupported(lang)) {
        errors.push(
          `${channelId}:${lang} — "${lang}" is not a supported language code`,
        );
        continue;
      }

      validated.push({ channelId, lang });
    }

    if (validated.length === 0) {
      await submission.editReply({
        content: `No valid entries found:\n${errors.map((e) => `• ${e}`).join("\n")}`,
      });
      return;
    }

    // ── Check that none of these channels already belong to a group ──────────
    const existingMembers = await db.channelGroupMember.findMany({
      where: { channelId: { in: validated.map((v) => v.channelId) } },
      include: { group: true },
    });

    for (const existing of existingMembers) {
      errors.push(
        `${existing.channelId} — already belongs to group ${existing.groupId} in guild ${existing.group.guildId}`,
      );
    }

    const takenIds = new Set(
      existingMembers.map((m: { channelId: any }) => m.channelId),
    );
    const clean = validated.filter((v) => !takenIds.has(v.channelId));

    if (clean.length < 2) {
      await submission.editReply({
        content: `Need at least 2 free channels to create a group.\n${errors.map((e) => `• ${e}`).join("\n")}`,
      });
      return;
    }

    // Report partial validation failures but still proceed with valid entries.
    const group = await db.channelGroup.create({
      data: {
        guildId: interaction.guildId!,
        members: {
          create: clean.map((v) => ({
            channelId: v.channelId,
            languageCode: v.lang,
          })),
        },
      },
      include: { members: true },
    });

    const embed = new EmbedBuilder()
      .setTitle("Translation Group Created")
      .setColor(0x5865f2)
      .addFields(
        { name: "Group ID", value: group.id, inline: false },
        {
          name: "Linked Channels",
          value: group.members
            .map(
              (m: { channelId: any; languageCode: any }) =>
                `<#${m.channelId}> — \`${m.languageCode}\``,
            )
            .join("\n"),
          inline: false,
        },
      );

    if (errors.length > 0) {
      embed.addFields({
        name: "Skipped Entries",
        value: errors.map((e) => `• ${e}`).join("\n"),
        inline: false,
      });
    }

    await submission.editReply({ embeds: [embed] });
  },
};

export default command;
