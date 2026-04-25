import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  ChannelType,
} from "discord.js";
import { Command } from "@/types/index";
import { EMBED_COLOR } from "@/utils/constants";
import db from "@/utils/db";
import { isLanguageSupported } from "@/utils/translate";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("link-channels")
    .setDescription("Create a translation group with exactly two channels")
    .addChannelOption((option) =>
      option
        .setName("channel_one")
        .setDescription("First text channel")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("language_one")
        .setDescription("Language code for the first channel")
        .setRequired(true),
    )
    .addChannelOption((option) =>
      option
        .setName("channel_two")
        .setDescription("Second text channel")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("language_two")
        .setDescription("Language code for the second channel")
        .setRequired(true),
    ) as SlashCommandBuilder,
  requiredRoles: ["R4", "R5"],

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const channelOne = interaction.options.getChannel("channel_one", true);
    const channelTwo = interaction.options.getChannel("channel_two", true);
    const languageOne = interaction.options
      .getString("language_one", true)
      .trim()
      .toLowerCase();
    const languageTwo = interaction.options
      .getString("language_two", true)
      .trim()
      .toLowerCase();

    if (channelOne.id === channelTwo.id) {
      await interaction.editReply({
        content: "Please provide two different channels.",
      });
      return;
    }

    if (
      !isLanguageSupported(languageOne) ||
      !isLanguageSupported(languageTwo)
    ) {
      await interaction.editReply({
        content:
          "Invalid language code. Supported languages are `en`, `ru`, and `de`.",
      });
      return;
    }

    const existingMembers = await db.channelGroupMember.findMany({
      where: { channelId: { in: [channelOne.id, channelTwo.id] } },
      include: { group: true },
    });

    if (existingMembers.length > 0) {
      await interaction.editReply({
        content:
          "One or more channels are already linked to a group:\n" +
          existingMembers
            .map(
              (existing) =>
                `• <#${existing.channelId}> already belongs to group \`${existing.groupId}\``,
            )
            .join("\n"),
      });
      return;
    }

    const group = await db.channelGroup.create({
      data: {
        guildId: interaction.guildId!,
        members: {
          create: [
            {
              channelId: channelOne.id,
              languageCode: languageOne,
            },
            {
              channelId: channelTwo.id,
              languageCode: languageTwo,
            },
          ],
        },
      },
      include: { members: true },
    });

    const embed = new EmbedBuilder()
      .setTitle("Translation Group Created")
      .setColor(EMBED_COLOR)
      .addFields(
        { name: "Group ID", value: group.id, inline: false },
        {
          name: "Linked Channels",
          value: group.members
            .map(
              (m: { channelId: string; languageCode: string }) =>
                `<#${m.channelId}> — \`${m.languageCode}\``,
            )
            .join("\n"),
          inline: false,
        },
      );

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
