import { Client } from "discord.js";
import { BotEvent } from "@/types/index";
import { initWebhookCache } from "@/utils/webhook";

let shutdownRegistered = false;

const event: BotEvent<"clientReady"> = {
  name: "clientReady",
  once: true,
  async execute(client: Client<true>) {
    console.log(`[Bot] Logged in as ${client.user.tag}`);

    await initWebhookCache(client);

    if (!shutdownRegistered) {
      shutdownRegistered = true;
      const shutdown = () => {
        console.log("[Bot] Shutting down gracefully.");
        client.destroy();
        process.exit(0);
      };
      process.once("SIGTERM", shutdown);
      process.once("SIGINT", shutdown);
    }
  },
};

export default event;
