import {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { Command } from '@/types/index';
import db from '@/utils/db';

// discord.js v14 does not expose showModal on ModalSubmitInteraction, so
// we collect both inputs (action + target) in a single modal instead of chaining two.

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('unlink-channels')
    .setDescription('Remove a channel from its group or dissolve an entire group'),
  requiredRoles: ['R4', 'R5'],

  async execute(interaction: ChatInputCommandInteraction) {
    const modal = new ModalBuilder()
      .setCustomId('unlink-modal')
      .setTitle('Unlink Channels');

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('action')
          .setLabel('Action — type "channel" or "group"')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('channel')
          .setRequired(true),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('target')
          .setLabel('Channel ID or Group ID')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Paste the channel ID or group UUID here')
          .setRequired(true),
      ),
    );

    await interaction.showModal(modal);

    const submission = await interaction
      .awaitModalSubmit({
        time: 5 * 60_000,
        filter: (i) => i.customId === 'unlink-modal' && i.user.id === interaction.user.id,
      })
      .catch(() => null);

    if (!submission) return;

    await submission.deferReply({ ephemeral: true });

    const action = submission.fields.getTextInputValue('action').trim().toLowerCase();
    const target = submission.fields.getTextInputValue('target').trim();

    if (action !== 'channel' && action !== 'group') {
      await submission.editReply({
        content: 'Invalid action. Must be exactly `channel` or `group`.',
      });
      return;
    }

    if (action === 'channel') {
      const member = await db.channelGroupMember.findFirst({
        where: { channelId: target },
      });

      if (!member) {
        await submission.editReply({
          content: `Channel \`${target}\` is not in any group.`,
        });
        return;
      }

      await db.channelGroupMember.delete({ where: { id: member.id } });

      // Dissolve the group automatically if fewer than 2 members remain.
      const remaining = await db.channelGroupMember.count({
        where: { groupId: member.groupId },
      });

      if (remaining < 2) {
        await db.channelGroup.delete({ where: { id: member.groupId } });
        await submission.editReply({
          content: `<#${target}> removed. Group \`${member.groupId}\` was dissolved because fewer than 2 channels remained.`,
        });
        return;
      }

      await submission.editReply({
        content: `<#${target}> has been removed from group \`${member.groupId}\`.`,
      });
    } else {
      const group = await db.channelGroup.findUnique({
        where: { id: target },
        include: { members: true },
      });

      if (!group) {
        await submission.editReply({ content: `No group found with ID \`${target}\`.` });
        return;
      }

      // onDelete: Cascade in the schema removes all members automatically.
      await db.channelGroup.delete({ where: { id: target } });

      await submission.editReply({
        content: `Group \`${target}\` dissolved. ${group.members.length} channel(s) unlinked.`,
      });
    }
  },
};

export default command;
