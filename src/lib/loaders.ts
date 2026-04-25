import * as fs from 'fs';
import * as path from 'path';
import { ClientEvents } from 'discord.js';
import { Command, BotEvent, ExtendedClient } from '@/types/index';

function getFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? getFiles(full) : [full];
  });
}

export async function loadCommands(client: ExtendedClient): Promise<void> {
  const dir = path.join(__dirname, '..', 'commands');
  const files = getFiles(dir).filter((f) => f.endsWith('.ts') || f.endsWith('.js'));

  for (const file of files) {
    const mod = await import(file);
    const command: Command = mod.default;

    if (!command?.data || !Array.isArray(command.requiredRoles)) {
      console.warn(`[Loader] Skipping ${file} — missing data or requiredRoles`);
      continue;
    }

    client.commands.set(command.data.name, command);
    console.log(`[Loader] Loaded command: /${command.data.name}`);
  }
}

export async function loadEvents(client: ExtendedClient): Promise<void> {
  const dir = path.join(__dirname, '..', 'events');
  const files = getFiles(dir).filter((f) => f.endsWith('.ts') || f.endsWith('.js'));

  for (const file of files) {
    const mod = await import(file);
    const event: BotEvent<keyof ClientEvents> = mod.default;

    if (!event?.name) {
      console.warn(`[Loader] Skipping ${file} — missing event name`);
      continue;
    }

    // Wrap in an async handler so unhandled rejections inside event.execute
    // are caught here rather than propagating to the process-level handler.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (...args: any[]) =>
      Promise.resolve(event.execute(...(args as any))).catch((err) =>
        console.error(`[Event:${event.name}] Unhandled error:`, err),
      );

    if (event.once) {
      client.once(event.name as any, handler);
    } else {
      client.on(event.name as any, handler);
    }

    console.log(`[Loader] Registered event: ${event.name}`);
  }
}
