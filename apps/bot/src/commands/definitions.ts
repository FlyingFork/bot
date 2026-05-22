import { groupCommand } from "./group.js";
import { rolesCommand } from "./roles.js";
import { statsCommand } from "./stats.js";
import { adminLogCommand } from "./adminLog.js";
import type { BotCommand } from "./types.js";

export const commands: BotCommand[] = [
  groupCommand,
  rolesCommand,
  statsCommand,
  adminLogCommand
];

export const commandData = commands.map((command) => command.data.toJSON());
