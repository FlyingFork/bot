import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '@/types/index';
import db from '@/utils/db';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('list-linked-groups')
    .setDescription('List all translation channel groups in this server'),
  requiredRoles: [],

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const groups = await db.channelGroup.findMany({
      where: { guildId: interaction.guildId! },
      include: { members: true },
      orderBy: { createdAt: 'asc' },
    });

    if (groups.length === 0) {
      await interaction.editReply({ content: 'No linked channel groups found in this server.' });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('Translation Channel Groups')
      .setColor(0x5865f2)
      .setDescription(`${groups.length} group(s) found`);

    for (const group of groups) {
      const memberList = group.members
        .map((m) => `<#${m.channelId}> — \`${m.languageCode}\``)
        .join('\n');

      embed.addFields({
        name: `Group \`${group.id}\``,
        value: memberList || '_No members_',
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
