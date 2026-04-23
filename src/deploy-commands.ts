import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { REST, Routes } from "discord.js";
import { Command } from "@/types/index";

function getFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? getFiles(full) : [full];
  });
}

function parseGuildIds(env: NodeJS.ProcessEnv): string[] {
  const fromList =
    env.GUILD_IDS?.split(",")
      .map((id) => id.trim())
      .filter(Boolean) ?? [];

  if (fromList.length > 0) return [...new Set(fromList)];

  if (env.GUILD_ID?.trim()) return [env.GUILD_ID.trim()];

  return [];
}

async function deploy() {
  const { DISCORD_TOKEN, CLIENT_ID } = process.env;
  const guildIds = parseGuildIds(process.env);

  if (!DISCORD_TOKEN || !CLIENT_ID || guildIds.length === 0) {
    throw new Error(
      "Missing DISCORD_TOKEN, CLIENT_ID, and at least one guild id (GUILD_IDS or GUILD_ID) in .env",
    );
  }

  const dir = path.join(process.cwd(), "src", "commands");
  const files = getFiles(dir).filter(
    (f) => f.endsWith(".ts") || f.endsWith(".js"),
  );

  const commandData: object[] = [];
  for (const file of files) {
    const mod = await import(file);
    const command: Command = mod.default;
    if (command?.data) {
      commandData.push(command.data.toJSON());
    }
  }

  const rest = new REST().setToken(DISCORD_TOKEN);
  for (const guildId of guildIds) {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, guildId), {
      body: commandData,
    });
    console.log(
      `[Deploy] Guild ${guildId}: successfully registered ${commandData.length} application commands.`,
    );
  }

  console.log(`[Deploy] Completed for ${guildIds.length} guild(s).`);
}

deploy().catch(console.error);
