import { config } from "./config.js";
import { prisma } from "./db.js";
import { logger } from "./logger.js";
import { client } from "./discordClient.js";
import { registerInteractionEvents } from "./events/interactions.js";
import { registerMessageEvents } from "./events/messages.js";
import { registerReactionEvents } from "./events/reactions.js";
import { registerThreadEvents } from "./events/threads.js";
import { registerChannelEvents } from "./events/channels.js";
import { refreshAllReactionRoleMessages } from "./commands/roles.js";
export { client };

client.once("clientReady", async (readyClient) => {
  logger.info({ tag: readyClient.user.tag }, "translation bot ready");
  await refreshAllReactionRoleMessages(readyClient).catch((error) => {
    logger.warn({ error }, "failed to refresh reaction role messages on startup");
  });
});

registerInteractionEvents(client);
registerMessageEvents(client);
registerReactionEvents(client);
registerThreadEvents(client);
registerChannelEvents(client);

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("unhandledRejection", (error) => {
  logger.error({ error }, "unhandled promise rejection");
});

await client.login(config.discordToken);

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "shutting down");
  client.destroy();
  await prisma.$disconnect();
  process.exit(0);
}
