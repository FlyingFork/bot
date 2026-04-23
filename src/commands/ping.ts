import { SlashCommandBuilder } from "discord.js";
import { Command } from "@/types/index";
import { checkLibreTranslateHealth } from "@/utils/translate";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("R4/R5 ping command"),
  requiredRoles: ["R4", "R5"],
  async execute(interaction) {
    await interaction.reply({
      content: "Pinging...",
      ephemeral: true,
    });
    const sent = await interaction.fetchReply();
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    const health = await checkLibreTranslateHealth();

    const libStatus = health.ok ? "OK" : "FAIL";
    const missing =
      health.missingLanguages.length > 0
        ? health.missingLanguages.join(", ")
        : "none";

    await interaction.editReply({
      content:
        `Latency: ${latency}ms | API: ${interaction.client.ws.ping}ms\n` +
        `LibreTranslate: ${libStatus} (${health.latencyMs}ms)\n` +
        `API key configured: ${health.apiKeyConfigured ? "yes" : "no"}\n` +
        `Missing required languages (en, ru, de): ${missing}\n` +
        `Details: ${health.message}`,
    });
  },
};

export default command;
