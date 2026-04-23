import {
  ChannelType,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { Command } from "@/types/index";
import db from "@/utils/db";
import { isLanguageSupported } from "@/utils/translate";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("add-channel-to-group")
    .setDescription("Add one channel to an existing translation group")
    .addStringOption((option) =>
      option
        .setName("group_id")
        .setDescription("Existing translation group ID")
        .setRequired(true),
    )
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Text channel to add")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("language")
        .setDescription("Language code for this channel")
        .setRequired(true),
    ) as SlashCommandBuilder,
  requiredRoles: ["R4", "R5"],

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const groupId = interaction.options.getString("group_id", true).trim();
    const channel = interaction.options.getChannel("channel", true);
    const language = interaction.options
      .getString("language", true)
      .trim()
      .toLowerCase();

    if (!isLanguageSupported(language)) {
      await interaction.editReply({
        content:
          "Invalid language code. Supported languages are `en`, `ru`, and `de`.",
      });
      return;
    }

    const group = await db.channelGroup.findUnique({
      where: { id: groupId },
      include: { members: true },
    });

    if (!group || group.guildId !== interaction.guildId) {
      await interaction.editReply({
        content: `No group found with ID \`${groupId}\` in this server.`,
      });
      return;
    }

    const existingChannelMembership = await db.channelGroupMember.findFirst({
      where: { channelId: channel.id },
    });

    if (existingChannelMembership) {
      await interaction.editReply({
        content: `<#${channel.id}> is already in group \`${existingChannelMembership.groupId}\` and cannot be added twice.`,
      });
      return;
    }

    await db.channelGroupMember.create({
      data: {
        groupId,
        channelId: channel.id,
        languageCode: language,
      },
    });

    await interaction.editReply({
      content: `<#${channel.id}> (${language}) added to group \`${groupId}\`.`,
    });
  },
};

export default command;
