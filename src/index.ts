import "dotenv/config";
import { GatewayIntentBits, Partials } from "discord.js";
import { ExtendedClient } from "@/types/index";
import { loadCommands, loadEvents } from "@/lib/loaders";
import { validateTranslationConfig } from "@/utils/translate";

const client = new ExtendedClient({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildWebhooks,
  ],
  partials: [Partials.Message, Partials.Channel],
});

async function main() {
  if (!process.env.DISCORD_TOKEN) throw new Error("DISCORD_TOKEN is required");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  validateTranslationConfig();
  await loadCommands(client);
  await loadEvents(client);
  await client.login(process.env.DISCORD_TOKEN);
}

main().catch(console.error);
