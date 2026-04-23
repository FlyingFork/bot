import { Client } from 'discord.js';
import { BotEvent } from '@/types/index';

const event: BotEvent<'clientReady'> = {
  name: 'clientReady',
  once: true,
  execute(client: Client<true>) {
    console.log(`[Bot] Logged in as ${client.user.tag}`);
  },
};

export default event;
