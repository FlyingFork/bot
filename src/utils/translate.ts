import axios, { AxiosInstance } from "axios";
import {
  LIBRETRANSLATE_MAX_CHARS,
  LIBRE_TIMEOUT_MS,
  RETRY_DELAYS_MS,
  SUPPORTED_LANGS,
  type SupportedLang,
} from "@/utils/constants";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LibreDetectItem {
  confidence?: number;
  language?: string;
}

interface LibreTranslateResponse {
  translatedText?: string;
}

interface LibreLanguageItem {
  code?: string;
}

export interface LibreTranslateHealth {
  ok: boolean;
  latencyMs: number;
  baseUrl: string;
  apiKeyConfigured: boolean;
  missingLanguages: string[];
  message: string;
}

interface LibreConfig {
  baseUrl: string;
  apiKey?: string;
  timeoutMs: number;
}

// ── HTTP client ───────────────────────────────────────────────────────────────

let httpClient: AxiosInstance | null = null;

function normalizeLanguageCode(code: string): string {
  const normalized = code.trim().toLowerCase();
  const aliases: Record<string, SupportedLang> = {
    "en-us": "en",
    "en-gb": "en",
    "ru-ru": "ru",
  };
  return aliases[normalized] ?? normalized;
}

function getLibreConfig(): LibreConfig {
  // Priority: LIBRETRANSLATE_URL > LIBRETRANSLATE_BASE_URL > IP+PORT+PROTOCOL
  const explicitUrl =
    process.env.LIBRETRANSLATE_URL?.trim() ||
    process.env.LIBRETRANSLATE_BASE_URL?.trim();
  const host =
    process.env.LIBRETRANSLATE_IP?.trim() ??
    process.env.LIBRETRANSLATE_HOST?.trim();
  const port = process.env.LIBRETRANSLATE_PORT?.trim();
  const protocol = process.env.LIBRETRANSLATE_PROTOCOL?.trim() || "http";
  const timeoutRaw = process.env.LIBRETRANSLATE_TIMEOUT_MS?.trim();

  const baseUrl =
    explicitUrl || (host && port ? `${protocol}://${host}:${port}` : "");

  if (!baseUrl) {
    throw new Error(
      "[translate] Missing LibreTranslate config. Set LIBRETRANSLATE_URL or LIBRETRANSLATE_IP + LIBRETRANSLATE_PORT.",
    );
  }

  const timeoutMs = timeoutRaw ? Number(timeoutRaw) : LIBRE_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error(
      "[translate] LIBRETRANSLATE_TIMEOUT_MS must be a positive number.",
    );
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey: process.env.LIBRETRANSLATE_API_KEY?.trim() || undefined,
    timeoutMs,
  };
}

export function validateTranslationConfig(): void {
  getLibreConfig();
}

function getHttpClient(): AxiosInstance {
  if (httpClient) return httpClient;
  const config = getLibreConfig();
  httpClient = axios.create({
    baseURL: config.baseUrl,
    timeout: config.timeoutMs,
    headers: { "Content-Type": "application/json" },
  });
  return httpClient;
}

function withApiKey(payload: Record<string, unknown>): Record<string, unknown> {
  const apiKey = process.env.LIBRETRANSLATE_API_KEY?.trim();
  if (!apiKey) return payload;
  return { ...payload, api_key: apiKey };
}

// ── Health check ──────────────────────────────────────────────────────────────

export async function checkLibreTranslateHealth(): Promise<LibreTranslateHealth> {
  const required: SupportedLang[] = ["en", "ru"];
  const started = Date.now();

  try {
    const config = getLibreConfig();
    const client = getHttpClient();
    const { data } = await client.get<LibreLanguageItem[]>("/languages");

    const reportedCodes = Array.isArray(data)
      ? new Set(
          data
            .map((item) =>
              typeof item?.code === "string"
                ? normalizeLanguageCode(item.code)
                : "",
            )
            .filter(Boolean),
        )
      : new Set<string>();

    const missingLanguages = required.filter(
      (lang) => !reportedCodes.has(lang),
    );
    const latencyMs = Date.now() - started;
    const ok = missingLanguages.length === 0;

    return {
      ok,
      latencyMs,
      baseUrl: config.baseUrl,
      apiKeyConfigured: Boolean(config.apiKey),
      missingLanguages,
      message: ok
        ? "LibreTranslate reachable and all required languages available."
        : `LibreTranslate reachable but missing: ${missingLanguages.join(", ")}`,
    };
  } catch (err) {
    const config = getLibreConfig().baseUrl;
    return {
      ok: false,
      latencyMs: Date.now() - started,
      baseUrl: config,
      apiKeyConfigured: Boolean(process.env.LIBRETRANSLATE_API_KEY?.trim()),
      missingLanguages: [...required],
      message: `LibreTranslate health check failed: ${(err as Error).message}`,
    };
  }
}

// ── Supported language helpers ────────────────────────────────────────────────

export function isLanguageSupported(code: string): boolean {
  return (SUPPORTED_LANGS as readonly string[]).includes(
    normalizeLanguageCode(code),
  );
}

/**
 * Returns true if the text has no alphabetic characters at all
 * (pure numbers, symbols, emoji, whitespace). No translation needed.
 */
export function isEmojiOrSymbolOnly(text: string): boolean {
  return !/\p{L}/u.test(text);
}

// ── Placeholder system ────────────────────────────────────────────────────────
//
// We extract opaque tokens from the text before sending to LibreTranslate so
// the translator never sees Discord mentions, custom emoji, URLs, code, or
// timestamps — those would be mangled or translated incorrectly.

const PLACEHOLDER_PATTERNS: RegExp[] = [
  /```[\s\S]*?```/g, // code blocks (highest priority)
  /`[^`]+`/g, // inline code
  /[\p{Extended_Pictographic}\u200d\uFE0F]+/gu, // Unicode emoji sequences (ZWJ, VS)
  /<t:\d+(?::[tTdDfFR])?>/g, // Discord timestamps
  /<a?:\w+:\d+>/g, // custom emoji
  /<@!?\d+>/g, // user mentions
  /<@&\d+>/g, // role mentions
  /<#\d+>/g, // channel mentions
  /https?:\/\/[^\s<>[\]{}|\\^`"]*[^\s<>[\]{}|\\^`".,;:!?()]/g, // URLs
];

interface ExtractResult {
  text: string;
  placeholders: string[];
}

function extractPlaceholders(text: string, token: string): ExtractResult {
  const placeholders: string[] = [];
  let result = text;

  for (const pattern of PLACEHOLDER_PATTERNS) {
    const fresh = new RegExp(pattern.source, pattern.flags);
    result = result.replace(fresh, (match) => {
      const idx = placeholders.push(match) - 1;
      // Pure-numeric format: ==NNNNNN_IDX== where NNNNNN is a 6-digit random token.
      // Numbers are never translated by any NMT model. The == delimiters are treated as
      // math/code notation and copied verbatim. Curly braces and alphabetic chars were
      // alphabetic chars in previous formats were mangled by some Argos models.
      return `==${token}${idx}==`;
    });
  }

  return { text: result, placeholders };
}

function restorePlaceholders(
  text: string,
  placeholders: string[],
  token: string,
): string {
  // token is always 6 digits, so (\d+) after it captures only the index.
  return text.replace(
    new RegExp(`==${token}(\\d+)==`, "g"),
    (_, idx) => placeholders[Number(idx)] ?? _,
  );
}

/**
 * Strips Discord tokens (mentions, emoji, URLs, code) from text before language
 * detection. Without this, large numeric mention IDs like <@123456789012345678>
 * confuse Argos's detector and push confidence below the threshold.
 */
export function sanitizeTextForDetection(text: string): string {
  let result = text;
  for (const pattern of PLACEHOLDER_PATTERNS) {
    const fresh = new RegExp(pattern.source, pattern.flags);
    result = result.replace(fresh, " ");
  }
  return result.replace(/\s+/g, " ").trim();
}

// ── Spoiler tag handling ──────────────────────────────────────────────────────

const SPOILER_REGEX = /\|\|([^|]+)\|\|/g;

async function translateSpoilers(
  text: string,
  sourceLang: string,
  targetLang: string,
): Promise<string> {
  const matches: Array<{ full: string; inner: string; index: number }> = [];
  let m: RegExpExecArray | null;
  const freshRegex = new RegExp(SPOILER_REGEX.source, SPOILER_REGEX.flags);
  while ((m = freshRegex.exec(text)) !== null) {
    matches.push({ full: m[0], inner: m[1], index: m.index });
  }
  if (matches.length === 0) return text;

  let result = text;
  for (const { full, inner } of matches) {
    const translated = await callLibreTranslate(inner, sourceLang, targetLang);
    result = result.replace(full, `||${translated}||`);
  }
  return result;
}

// ── Translation cache ─────────────────────────────────────────────────────────

const cache = new Map<string, string>();
const MAX_CACHE_SIZE = 500;

function cacheSet(key: string, value: string): void {
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
}

// ── Core LibreTranslate call with retry ───────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callLibreTranslate(
  text: string,
  sourceLang: string,
  targetLang: string,
): Promise<string> {
  const client = getHttpClient();
  let lastError: Error = new Error("Unknown error");

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const payload = withApiKey({
        q: text,
        source: sourceLang,
        target: targetLang,
        format: "text",
      });
      const { data } = await client.post<LibreTranslateResponse>(
        "/translate",
        payload,
      );
      const translated = data?.translatedText;
      if (typeof translated !== "string") {
        throw new Error("Invalid response shape from LibreTranslate.");
      }
      return translated;
    } catch (err) {
      lastError = err as Error;
      if (attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]);
      }
    }
  }

  throw new Error(
    `LibreTranslate failed after ${RETRY_DELAYS_MS.length + 1} attempts: ${lastError.message}`,
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Translates text from sourceLang to targetLang.
 * Extracts and restores placeholders so mentions/URLs/emoji/code are never touched.
 * Results are cached per (sourceLang, targetLang, normalizedText).
 */
export async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string,
): Promise<string> {
  if (!text.trim()) return text;

  if (text.length > LIBRETRANSLATE_MAX_CHARS) {
    throw new Error(
      `Message too long for translation (${text.length} chars, max ${LIBRETRANSLATE_MAX_CHARS}).`,
    );
  }

  const normalizedSource = normalizeLanguageCode(sourceLang);
  const normalizedTarget = normalizeLanguageCode(targetLang);

  if (!isLanguageSupported(normalizedSource)) {
    throw new Error(`Unsupported source language: "${sourceLang}"`);
  }
  if (!isLanguageSupported(normalizedTarget)) {
    throw new Error(`Unsupported target language: "${targetLang}"`);
  }

  if (normalizedSource === normalizedTarget) return text;

  const normalizedText = text.trim().replace(/\s+/g, " ");
  const cacheKey = `${normalizedSource}:${normalizedTarget}:${normalizedText}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;

  // 6-digit zero-padded numeric token — pure numbers survive all Argos language models
  const token = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");
  const { text: masked, placeholders } = extractPlaceholders(
    normalizedText,
    token,
  );

  // Handle spoiler tags: translate inner content, re-wrap
  const withTranslatedSpoilers = await translateSpoilers(
    masked,
    normalizedSource,
    normalizedTarget,
  );

  const translated = await callLibreTranslate(
    withTranslatedSpoilers,
    normalizedSource,
    normalizedTarget,
  );
  const result = restorePlaceholders(translated, placeholders, token);

  cacheSet(cacheKey, result);
  return result;
}

/**
 * Detects the language of a string.
 * Returns { lang, confidence } where confidence is 0–1.
 * Falls back to { lang: 'unknown', confidence: 0 } on error.
 */
export async function detectLanguage(
  text: string,
): Promise<{ lang: string; confidence: number }> {
  if (!text.trim()) return { lang: "unknown", confidence: 0 };

  try {
    const client = getHttpClient();
    const payload = withApiKey({ q: text });
    const { data } = await client.post<LibreDetectItem[]>("/detect", payload);

    const detected = Array.isArray(data) ? data[0] : undefined;
    const detectedLangRaw =
      typeof detected?.language === "string" ? detected.language : "unknown";
    const lang = normalizeLanguageCode(detectedLangRaw);

    const rawConfidence =
      typeof detected?.confidence === "number" ? detected.confidence : 0;
    const confidence = rawConfidence > 1 ? rawConfidence / 100 : rawConfidence;

    if (!isLanguageSupported(lang)) {
      return { lang: "unknown", confidence: 0 };
    }

    return { lang, confidence };
  } catch (err) {
    console.error("[translate] Language detection failed:", err);
    return { lang: "unknown", confidence: 0 };
  }
}
