export const EMBED_COLOR = 0x5865f2 as const;

export const DISCORD_MESSAGE_LIMIT = 2000;
export const LIBRETRANSLATE_MAX_CHARS = 5000;

export const LANG_MAP = { english: "en", russian: "ru" } as const;
export type LangChoice = keyof typeof LANG_MAP;

export const SUPPORTED_LANGS = ["en", "ru"] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

export const RATE_LIMIT_MAX = 5;
export const RATE_LIMIT_WINDOW_MS = 10_000;

export const LRU_MAX_PER_GUILD = 1000;

export const WEBHOOK_NAME = "TranslationBot";

export const RETRY_DELAYS_MS = [500, 1_000, 2_000] as const;

export const LIBRE_TIMEOUT_MS = 10_000;
