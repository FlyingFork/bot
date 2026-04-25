import { ActivityType, Client } from "discord.js";
import type { BotStatusConfig } from "@/generated/prisma/client";
import db from "@/utils/db";
import { isLanguageSupported, translateText } from "@/utils/translate";

export type StatusConfigInput = {
  enabled: boolean;
  activityType: string;
  message: string;
  countdownTargetAt: Date | null;
  languageCodes: string[];
  translationIntervalSeconds: number;
  currentLanguageIndex?: number;
};

const STATUS_ROW_ID = "global";
const DEFAULT_INTERVAL_SECONDS = 30;
const MIN_INTERVAL_SECONDS = 5;

let scheduler: NodeJS.Timeout | null = null;
let schedulerClient: Client<true> | null = null;
let tickInProgress = false;

const ACTIVITY_TYPE_MAP: Record<string, ActivityType> = {
  playing: ActivityType.Playing,
  streaming: ActivityType.Streaming,
  listening: ActivityType.Listening,
  watching: ActivityType.Watching,
  competing: ActivityType.Competing,
  custom: ActivityType.Custom,
};

function normalizeActivityType(value: string): ActivityType | null {
  const normalized = value.trim().toLowerCase();
  return ACTIVITY_TYPE_MAP[normalized] ?? null;
}

function parseLanguageCodes(raw: string): string[] {
  return raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .filter((entry) => isLanguageSupported(entry));
}

function parseStoredLanguages(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((entry) =>
        typeof entry === "string" ? entry.trim().toLowerCase() : "",
      )
      .filter((entry) => entry.length > 0 && isLanguageSupported(entry));
  } catch {
    return [];
  }
}

function serializeLanguages(languageCodes: string[]): string {
  return JSON.stringify(languageCodes);
}

function truncatePresenceText(text: string): string {
  return text.length > 128 ? `${text.slice(0, 125)}...` : text;
}

function formatCountdown(target: Date, now = new Date()): string | null {
  const diffMs = target.getTime() - now.getTime();
  if (diffMs <= 0) return null;

  const totalMinutes = Math.floor(diffMs / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes - days * 24 * 60) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return hours > 0 ? `in ${days}d ${hours}h` : `in ${days}d`;
  }

  if (hours > 0) {
    return minutes > 0 ? `in ${hours}h ${minutes}m` : `in ${hours}h`;
  }

  if (minutes > 0) {
    return `in ${minutes}m`;
  }

  return "soon";
}

function buildPresenceMessage(
  config: BotStatusConfig,
  now = new Date(),
): string | null {
  const countdownSuffix = config.countdownTargetAt
    ? formatCountdown(config.countdownTargetAt, now)
    : null;

  if (config.countdownTargetAt && countdownSuffix === null) {
    return null;
  }

  return countdownSuffix
    ? `${config.message} ${countdownSuffix}`
    : config.message;
}

function resolveActivityType(value: string): ActivityType {
  return normalizeActivityType(value) ?? ActivityType.Playing;
}

async function readStatusConfig(): Promise<BotStatusConfig | null> {
  return db.botStatusConfig.findUnique({ where: { id: STATUS_ROW_ID } });
}

export async function upsertStatusConfig(
  input: StatusConfigInput,
): Promise<void> {
  const intervalSeconds = Math.max(
    MIN_INTERVAL_SECONDS,
    Number.isFinite(input.translationIntervalSeconds)
      ? Math.floor(input.translationIntervalSeconds)
      : DEFAULT_INTERVAL_SECONDS,
  );
  const languages = input.languageCodes.filter((code) =>
    isLanguageSupported(code),
  );

  await db.botStatusConfig.upsert({
    where: { id: STATUS_ROW_ID },
    create: {
      id: STATUS_ROW_ID,
      enabled: input.enabled,
      activityType: input.activityType,
      message: input.message,
      countdownTargetAt: input.countdownTargetAt,
      languageCodesJson: serializeLanguages(languages),
      translationIntervalSeconds: intervalSeconds,
      currentLanguageIndex: input.currentLanguageIndex ?? 0,
    },
    update: {
      enabled: input.enabled,
      activityType: input.activityType,
      message: input.message,
      countdownTargetAt: input.countdownTargetAt,
      languageCodesJson: serializeLanguages(languages),
      translationIntervalSeconds: intervalSeconds,
      currentLanguageIndex: input.currentLanguageIndex ?? 0,
    },
  });
}

async function clearPresence(client: Client<true>): Promise<void> {
  client.user.setPresence({ activities: [], status: "online" });
}

async function applyStatusFromConfig(
  client: Client<true>,
  config: BotStatusConfig,
): Promise<void> {
  const languages = parseStoredLanguages(config.languageCodesJson);

  if (!config.enabled || languages.length === 0) {
    await clearPresence(client);
    return;
  }

  const baseMessage = buildPresenceMessage(config, new Date());

  if (baseMessage === null) {
    // E5: countdown expired — stop the scheduler so we don't keep writing to DB
    if (scheduler) {
      clearInterval(scheduler);
      scheduler = null;
    }
    await upsertStatusConfig({
      enabled: false,
      activityType: config.activityType,
      message: config.message,
      countdownTargetAt: config.countdownTargetAt,
      languageCodes: languages,
      translationIntervalSeconds: config.translationIntervalSeconds,
      currentLanguageIndex: config.currentLanguageIndex,
    });
    await clearPresence(client);
    return;
  }

  const normalizedIndex =
    ((config.currentLanguageIndex % languages.length) + languages.length) %
    languages.length;
  const targetLanguage = languages[normalizedIndex];
  const translatedMessage =
    targetLanguage === "en"
      ? baseMessage
      : await translateText(baseMessage, targetLanguage).catch((err) => {
          console.error("[status] Translation failed:", err);
          return baseMessage;
        });

  client.user.setPresence({
    activities: [
      {
        name: truncatePresenceText(translatedMessage),
        type: resolveActivityType(config.activityType),
      },
    ],
    status: "online",
  });

  await upsertStatusConfig({
    enabled: true,
    activityType: config.activityType,
    message: config.message,
    countdownTargetAt: config.countdownTargetAt,
    languageCodes: languages,
    translationIntervalSeconds: config.translationIntervalSeconds,
    currentLanguageIndex: (normalizedIndex + 1) % languages.length,
  });
}

async function tickStatusScheduler(): Promise<void> {
  if (!schedulerClient || tickInProgress) return;
  tickInProgress = true;

  try {
    const config = await readStatusConfig();
    if (!config) {
      await clearPresence(schedulerClient);
      return;
    }

    await applyStatusFromConfig(schedulerClient, config);
  } catch (err) {
    console.error("[status] Failed to update bot presence:", err);
  } finally {
    tickInProgress = false;
  }
}

export async function restartStatusScheduler(
  client: Client<true>,
): Promise<void> {
  schedulerClient = client;

  if (scheduler) {
    clearInterval(scheduler);
    scheduler = null;
  }

  const config = await readStatusConfig();

  if (!config || !config.enabled) {
    await clearPresence(client);
    return;
  }

  await applyStatusFromConfig(client, config);

  const intervalSeconds = Math.max(
    MIN_INTERVAL_SECONDS,
    config.translationIntervalSeconds || DEFAULT_INTERVAL_SECONDS,
  );

  scheduler = setInterval(() => {
    void tickStatusScheduler();
  }, intervalSeconds * 1000);
}

export async function resetBotStatus(client: Client<true>): Promise<void> {
  if (scheduler) {
    clearInterval(scheduler);
    scheduler = null;
  }

  schedulerClient = client;

  await upsertStatusConfig({
    enabled: false,
    activityType: "playing",
    message: "",
    countdownTargetAt: null,
    languageCodes: ["en"],
    translationIntervalSeconds: DEFAULT_INTERVAL_SECONDS,
    currentLanguageIndex: 0,
  });

  await clearPresence(client);
}

export function parseStatusLanguages(raw: string): string[] {
  return parseLanguageCodes(raw);
}

export function parseStatusCountdown(raw: string): Date | null {
  const value = raw.trim();
  if (!value) return null;

  const utcDateTimeMatch = value.match(
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?$/,
  );
  const hasTimezone = /[+-]\d{2}:?\d{2}$/.test(value) || value.endsWith("Z");
  const normalized = utcDateTimeMatch
    ? `${utcDateTimeMatch[1]}T${utcDateTimeMatch[2]}:${utcDateTimeMatch[3] ?? "00"}Z`
    : hasTimezone
      ? value
      : /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? `${value}T00:00:00Z`
        : value;

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseStatusActivityType(raw: string): ActivityType | null {
  return normalizeActivityType(raw);
}
