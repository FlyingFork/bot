import { Interaction } from 'discord.js';
import { BotEvent, ExtendedClient } from '@/types/index';
import { checkRoles } from '@/utils/checkRoles';

const event: BotEvent<'interactionCreate'> = {
  name: 'interactionCreate',
  async execute(interaction: Interaction) {
    if (!interaction.isChatInputCommand()) {
      // D2: Button and modal interactions are handled by inline awaitMessageComponent /
      // awaitModalSubmit collectors inside each command. Use setImmediate so active
      // collectors get priority; if nothing claims the interaction in the same
      // micro-task queue turn, reply with a clear expiry message instead of letting
      // Discord show the generic "This interaction failed" error.
      if (interaction.isButton() || interaction.isModalSubmit()) {
        setImmediate(() => {
          if (!interaction.replied && !interaction.deferred) {
            interaction
              .reply({
                content: 'This interaction has expired. Please run the command again.',
                ephemeral: true,
              })
              .catch(() => {}); // silently ignore if a collector already acknowledged it
          }
        });
      }
      return;
    }

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
