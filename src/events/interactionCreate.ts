import { Interaction } from 'discord.js';
import { BotEvent, ExtendedClient } from '@/types/index';
import { checkRoles } from '@/utils/checkRoles';

const event: BotEvent<'interactionCreate'> = {
  name: 'interactionCreate',
  async execute(interaction: Interaction) {
    if (!interaction.isChatInputCommand()) return;

    const client = interaction.client as ExtendedClient;
    const command = client.commands.get(interaction.commandName);

    if (!command) {
      await interaction.reply({ content: 'Unknown command.', ephemeral: true });
      return;
    }

    if (!checkRoles(interaction, command.requiredRoles)) {
      await interaction.reply({
        content: 'You do not have permission to use this command.',
        ephemeral: true,
      });
      return;
    }

    try {
      await command.execute(interaction, client);
    } catch (error) {
      console.error(`[Error] Command /${interaction.commandName}:`, error);
      const msg = { content: 'There was an error executing this command.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg);
      } else {
        await interaction.reply(msg);
      }
    }
  },
};

export default event;
