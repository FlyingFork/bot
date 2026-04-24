import { Client } from "discord.js";
import { BotEvent } from "@/types/index";
import { restartStatusScheduler } from "@/utils/status";
import db from "@/utils/db";

const FORWARDED_MSG_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

const event: BotEvent<"clientReady"> = {
  name: "clientReady",
  once: true,
  async execute(client: Client<true>) {
    console.log(`[Bot] Logged in as ${client.user.tag}`);
    await restartStatusScheduler(client);

    setInterval(async () => {
      const cutoff = new Date(Date.now() - FORWARDED_MSG_TTL_MS);
      await db.forwardedMessage
        .deleteMany({ where: { createdAt: { lt: cutoff } } })
        .then(({ count }) => {
          if (count > 0)
            console.log(`[cleanup] Pruned ${count} stale ForwardedMessage record(s).`);
        })
        .catch((err) =>
          console.error("[cleanup] Failed to prune ForwardedMessage records:", err),
        );
    }, 60 * 60 * 1000); // every hour
  },
};

export default event;
