import {
  Client,
  Collection,
  ClientOptions,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ClientEvents,
} from 'discord.js';

export interface Command {
  data: SlashCommandBuilder | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;
  requiredRoles: string[];
  execute(interaction: ChatInputCommandInteraction, client: ExtendedClient): Promise<void>;
}

export interface BotEvent<K extends keyof ClientEvents> {
  name: K;
  once?: boolean;
  execute(...args: ClientEvents[K]): Promise<void> | void;
}

export class ExtendedClient extends Client {
  commands: Collection<string, Command> = new Collection();

  constructor(options: ClientOptions) {
    super(options);
  }
}
