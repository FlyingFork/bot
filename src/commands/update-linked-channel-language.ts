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
    .setName("update-linked-channel-language")
    .setDescription("Update the language for a linked channel")
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Linked text channel")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("language")
        .setDescription("New language code")
        .setRequired(true),
    ) as SlashCommandBuilder,
  requiredRoles: ["R4", "R5"],

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

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

    const membership = await db.channelGroupMember.findFirst({
      where: { channelId: channel.id },
    });

    if (!membership) {
      await interaction.editReply({
        content: `<#${channel.id}> is not linked to any group.`,
      });
      return;
    }

    await db.channelGroupMember.update({
      where: { id: membership.id },
      data: { languageCode: language },
    });

    await interaction.editReply({
      content: `<#${channel.id}> language updated to \`${language}\` in group \`${membership.groupId}\`.`,
    });
  },
};

export default command;
