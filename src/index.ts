import "dotenv/config";
import { GatewayIntentBits, Partials } from "discord.js";
import { ExtendedClient } from "@/types/index";
import { loadCommands, loadEvents } from "@/lib/loaders";
import { validateTranslationConfig } from "@/utils/translate";

const client = new ExtendedClient({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages, // messageCreate event
    GatewayIntentBits.MessageContent, // read message.content (privileged)
  ],
  // Keep partials for message/channel access in translation-forwarded flows.
  partials: [Partials.Message, Partials.Channel],
});

async function main() {
  validateTranslationConfig();
  await loadCommands(client);
  await loadEvents(client);
  await client.login(process.env.DISCORD_TOKEN);
}

main().catch(console.error);
