import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  LIBRETRANSLATE_URL: z.string().url(),
  LIBRETRANSLATE_API_KEY: z.string().optional().default(""),
  DEV_GUILD_IDS: z.string().optional().default(""),
  LOG_LEVEL: z.string().optional().default("info")
});

const env = envSchema.parse(process.env);

export const config = {
  discordToken: env.DISCORD_TOKEN,
  discordClientId: env.DISCORD_CLIENT_ID,
  databaseUrl: env.DATABASE_URL,
  libreTranslateUrl: env.LIBRETRANSLATE_URL.replace(/\/$/, ""),
  libreTranslateApiKey: env.LIBRETRANSLATE_API_KEY || undefined,
  devGuildIds: env.DEV_GUILD_IDS.split(",").map((id) => id.trim()).filter(Boolean),
  logLevel: env.LOG_LEVEL
};
