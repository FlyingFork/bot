import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { Command } from "@/types/index";
import { resetBotStatus } from "@/utils/status";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("reset_status")
    .setDescription("Reset the bot status back to none"),
  requiredRoles: ["R5"],

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
      await interaction.reply({
        content: "This command can only be used inside a server.",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    await resetBotStatus(
      interaction.client as typeof interaction.client & {
        user: NonNullable<typeof interaction.client.user>;
      },
    );

    await interaction.editReply({
      content: "Bot status has been reset to none.",
    });
  },
};

export default command;
