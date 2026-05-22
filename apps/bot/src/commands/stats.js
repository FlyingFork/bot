import { SlashCommandBuilder } from "discord.js";
import { buildStatsReport } from "../services/stats.js";
export const statsCommand = {
    data: new SlashCommandBuilder()
        .setName("stats")
        .setDescription("Show bot statistics for this server"),
    async execute(interaction) {
        if (!interaction.guild)
            return;
        await interaction.deferReply({ ephemeral: true });
        await interaction.editReply(await buildStatsReport(interaction.guild.id));
    }
};
