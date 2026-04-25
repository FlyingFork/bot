import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '@/types/index';
import { EMBED_COLOR } from '@/utils/constants';
import db from '@/utils/db';

// Discord embed limits
const MAX_FIELD_VALUE_LEN = 1000;
const MAX_EMBED_FIELDS = 25;

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
      .setColor(EMBED_COLOR)
      .setDescription(`${groups.length} group(s) found`);

    // B5: guard Discord's 25-field and 1024-char-per-field limits
    const displayGroups = groups.slice(0, MAX_EMBED_FIELDS - 1);
    const overflow = groups.length - displayGroups.length;

    for (const group of displayGroups) {
      let memberList = group.members
        .map((m) => `<#${m.channelId}> — \`${m.languageCode}\``)
        .join('\n');

      if (memberList.length > MAX_FIELD_VALUE_LEN) {
        memberList = memberList.slice(0, MAX_FIELD_VALUE_LEN) + '\n…';
      }

      embed.addFields({
        name: `Group \`${group.id}\``,
        value: memberList || '_No members_',
        inline: false,
      });
    }

    if (overflow > 0) {
      embed.addFields({
        name: `+ ${overflow} more group(s)`,
        value: 'Use `/unlink-channels` or `/add-channel-to-group` to inspect further.',
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
