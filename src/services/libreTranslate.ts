import type { Language } from "../generated/prisma/client.js";
import { config } from "../config.js";
import { prisma } from "../db.js";
import { logger } from "../logger.js";
import { segmentProtectedText, splitDiscordMessages } from "./translationFormatter.js";

type DetectionResponse = Array<{ language: string; confidence: number }>;
type TranslateResponse = { translatedText: string };

async function requestLibre<T>(path: string, body: Record<string, unknown>, guildId?: string): Promise<{ data: T; latencyMs: number }> {
  const started = Date.now();
  const requestBody = config.libreTranslateApiKey ? { ...body, api_key: config.libreTranslateApiKey } : body;
  const response = await fetch(`${config.libreTranslateUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(10_000)
  });
  const latencyMs = Date.now() - started;

  if (!response.ok) {
    const responseBody = await response.text().catch(() => "");
    const context = sanitizeRequestContext(body);
    const error = [
      `LibreTranslate ${path} failed: ${response.status} ${response.statusText}`,
      `request=${JSON.stringify(context)}`,
      responseBody ? `body=${responseBody.slice(0, 500)}` : "body=<empty>"
    ].join(" ");
    await prisma.translationApiEvent.create({ data: { guildId, ok: false, latencyMs, error } });
    throw new Error(error);
  }

  await prisma.translationApiEvent.create({ data: { guildId, ok: true, latencyMs } });
  return { data: await response.json() as T, latencyMs };
}

function sanitizeRequestContext(body: Record<string, unknown>): Record<string, unknown> {
  return {
    apiKeyConfigured: Boolean(config.libreTranslateApiKey),
    ...Object.fromEntries(
    Object.entries(body)
      .filter(([key]) => key !== "api_key")
      .map(([key, value]) => [key, key === "q" && typeof value === "string" ? `${value.slice(0, 80)}${value.length > 80 ? "..." : ""}` : value])
    )
  };
}

export async function detectLanguage(text: string, guildId?: string): Promise<Language | null> {
  if (!text.trim()) {
    return null;
  }

  try {
    const { data } = await requestLibre<DetectionResponse>("/detect", { q: text }, guildId);
    const detected = data.sort((a, b) => b.confidence - a.confidence)[0]?.language;
    return detected === "en" || detected === "ru" || detected === "tr" ? detected : null;
  } catch (error) {
    logger.warn({ error }, "language detection failed");
    return null;
  }
}

export async function translateText(text: string, source: Language, target: Language, guildId?: string): Promise<{ chunks: string[]; latencyMs: number }> {
  if (!text.trim() || source === target) {
    return { chunks: splitDiscordMessages(text), latencyMs: 0 };
  }

  const segments = segmentProtectedText(text);
  let latencyMs = 0;
  let translatedText = "";

  for (const segment of segments) {
    if (segment.kind === "protected" || !segment.value.trim()) {
      translatedText += segment.value;
      continue;
    }

    const { data, latencyMs: segmentLatencyMs } = await requestLibre<TranslateResponse>("/translate", {
      q: segment.value,
      source,
      target,
      format: "text"
    }, guildId);
    latencyMs += segmentLatencyMs;
    translatedText += data.translatedText;
  }

  return { chunks: splitDiscordMessages(translatedText), latencyMs };
}
