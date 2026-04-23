import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { REST, Routes } from 'discord.js';
import { Command } from '@/types/index';

function getFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? getFiles(full) : [full];
  });
}

async function deploy() {
  const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

  if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
    throw new Error('Missing DISCORD_TOKEN, CLIENT_ID, or GUILD_ID in .env');
  }

  const dir = path.join(process.cwd(), 'src', 'commands');
  const files = getFiles(dir).filter((f) => f.endsWith('.ts') || f.endsWith('.js'));

  const commandData: object[] = [];
  for (const file of files) {
    const mod = await import(file);
    const command: Command = mod.default;
    if (command?.data) {
      commandData.push(command.data.toJSON());
    }
  }

  const rest = new REST().setToken(DISCORD_TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commandData });
  console.log(`[Deploy] Successfully registered ${commandData.length} application commands.`);
}

deploy().catch(console.error);
