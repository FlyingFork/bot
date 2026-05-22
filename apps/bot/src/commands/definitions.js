import { groupCommand } from "./group.js";
import { rolesCommand } from "./roles.js";
import { statsCommand } from "./stats.js";
import { adminLogCommand } from "./adminLog.js";
export const commands = [
    groupCommand,
    rolesCommand,
    statsCommand,
    adminLogCommand
];
export const commandData = commands.map((command) => command.data.toJSON());
