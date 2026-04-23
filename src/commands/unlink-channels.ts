import {
  SlashCommandBuilder,
  ChannelType,
  ChatInputCommandInteraction,
} from "discord.js";
import { Command } from "@/types/index";
import db from "@/utils/db";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("unlink-channels")
    .setDescription("Remove a channel from its group")
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Linked text channel to remove")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true),
    ) as SlashCommandBuilder,
  requiredRoles: ["R4", "R5"],

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const channel = interaction.options.getChannel("channel", true);
    const member = await db.channelGroupMember.findFirst({
      where: { channelId: channel.id },
    });

    if (!member) {
      await interaction.editReply({
        content: `<#${channel.id}> is not linked to any group.`,
      });
      return;
    }

    await db.channelGroupMember.delete({ where: { id: member.id } });

    const remaining = await db.channelGroupMember.count({
      where: { groupId: member.groupId },
    });

    if (remaining < 2) {
      await db.channelGroup.delete({ where: { id: member.groupId } });
      await interaction.editReply({
        content: `<#${channel.id}> removed. Group \`${member.groupId}\` was dissolved because fewer than 2 channels remained.`,
      });
      return;
    }

    await interaction.editReply({
      content: `<#${channel.id}> has been removed from group \`${member.groupId}\`.`,
    });
  },
};

export default command;
