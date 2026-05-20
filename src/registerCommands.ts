import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v10";
import { config } from "./config.js";
import { commandData } from "./commands/definitions.js";
import { logger } from "./logger.js";

const mode = process.argv[2];
if (mode !== "guild" && mode !== "global") {
  throw new Error("Usage: ts-node src/registerCommands.ts <guild|global>");
}

const rest = new REST({ version: "10" }).setToken(config.discordToken);

if (mode === "guild") {
  if (config.devGuildIds.length === 0) {
    throw new Error("DEV_GUILD_IDS must contain at least one guild ID for guild command registration");
  }

  for (const guildId of config.devGuildIds) {
    await rest.put(Routes.applicationGuildCommands(config.discordClientId, guildId), { body: commandData });
    logger.info({ guildId, count: commandData.length }, "registered guild commands");
  }
} else {
  await rest.put(Routes.applicationCommands(config.discordClientId), { body: commandData });
  logger.info({ count: commandData.length }, "registered global commands");
}
