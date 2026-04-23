import { Client } from "discord.js";
import { BotEvent } from "@/types/index";
import { restartStatusScheduler } from "@/utils/status";

const event: BotEvent<"clientReady"> = {
  name: "clientReady",
  once: true,
  async execute(client: Client<true>) {
    console.log(`[Bot] Logged in as ${client.user.tag}`);
    await restartStatusScheduler(client);
  },
};

export default event;
