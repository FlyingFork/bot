import { type Client, type GuildMember, type Interaction } from "discord.js";
import { commands } from "../commands/definitions.js";
import { confirmRoleAssignment } from "../commands/roles.js";
import { isAdmin } from "../services/permissions.js";
import { logToAdmin } from "../services/adminLog.js";
import { logger } from "../logger.js";
import type { Language } from "../generated/prisma/client.js";

const commandMap = new Map(commands.map((command) => [command.data.name, command]));

export function registerInteractionEvents(client: Client): void {
  client.on("interactionCreate", async (interaction: Interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        const member = interaction.member;
        if (!interaction.guild || !member || !isAdmin(member as GuildMember)) {
          await interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
          return;
        }

        const command = commandMap.get(interaction.commandName);
        if (!command) {
          await interaction.reply({ content: "Unknown command.", ephemeral: true });
          return;
        }

        await command.execute(interaction);
        return;
      }

      if (interaction.isButton() && interaction.customId.startsWith("roleassign:")) {
        const [, action, messageId, language, roleId, userId] = interaction.customId.split(":");
        if (interaction.user.id !== userId) {
          await interaction.reply({ content: "Only the admin who started this change can use these buttons.", ephemeral: true });
          return;
        }
        if (!interaction.guild || !isAdmin(interaction.member as GuildMember)) {
          await interaction.reply({ content: "You do not have permission to use this button.", ephemeral: true });
          return;
        }
        if (action === "cancel") {
          await interaction.update({ content: "Role assignment update cancelled.", components: [] });
          return;
        }
        await confirmRoleAssignment(interaction.guild.id, messageId, language as Language, roleId);
        await logToAdmin(interaction.guild, `${language} reaction role updated to <@&${roleId}> for message ${messageId}.`);
        await interaction.update({ content: `Updated role assignment to <@&${roleId}>.`, components: [] });
      }
    } catch (error) {
      logger.error({ error }, "interaction handler failed");
      if (interaction.isRepliable()) {
        const content = "The bot hit an error while handling that interaction.";
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({ content, ephemeral: true }).catch(() => undefined);
        } else {
          await interaction.reply({ content, ephemeral: true }).catch(() => undefined);
        }
      }
      await logToAdmin(interaction.guild ?? null, `Unhandled interaction error: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
}
