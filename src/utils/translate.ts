import axios, { AxiosInstance } from "axios";

type SupportedLanguage = "en" | "ru" | "de";

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

let httpClient: AxiosInstance | null = null;

function normalizeLanguageCode(code: string): string {
  const normalized = code.trim().toLowerCase();
  const aliases: Record<string, SupportedLanguage> = {
    "en-us": "en",
    "en-gb": "en",
    "de-de": "de",
    "ru-ru": "ru",
  };

  return aliases[normalized] ?? normalized;
}

function getLibreConfig(): LibreConfig {
  const explicitBaseUrl = process.env.LIBRETRANSLATE_BASE_URL?.trim();
  const host =
    process.env.LIBRETRANSLATE_IP?.trim() ??
    process.env.LIBRETRANSLATE_HOST?.trim();
  const port = process.env.LIBRETRANSLATE_PORT?.trim();
  const protocol = process.env.LIBRETRANSLATE_PROTOCOL?.trim() || "http";
  const timeoutRaw = process.env.LIBRETRANSLATE_TIMEOUT_MS?.trim();

  const baseUrl =
    explicitBaseUrl || (host && port ? `${protocol}://${host}:${port}` : "");

  if (!baseUrl) {
    throw new Error(
      "[translate] Missing LibreTranslate configuration. Set LIBRETRANSLATE_BASE_URL or LIBRETRANSLATE_IP + LIBRETRANSLATE_PORT.",
    );
  }

  const timeoutMs = timeoutRaw ? Number(timeoutRaw) : 8_000;
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
    headers: {
      "Content-Type": "application/json",
    },
  });

  return httpClient;
}

function withApiKey(payload: Record<string, unknown>): Record<string, unknown> {
  const apiKey = process.env.LIBRETRANSLATE_API_KEY?.trim();
  if (!apiKey) return payload;
  return { ...payload, api_key: apiKey };
}

export async function checkLibreTranslateHealth(): Promise<LibreTranslateHealth> {
  const requiredLanguages: SupportedLanguage[] = ["en", "ru", "de"];
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

    const missingLanguages = requiredLanguages.filter(
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
        ? "LibreTranslate reachable and required languages are available."
        : `LibreTranslate reachable but missing language support: ${missingLanguages.join(", ")}`,
    };
  } catch (err) {
    const configBaseUrl = process.env.LIBRETRANSLATE_BASE_URL?.trim();
    const host =
      process.env.LIBRETRANSLATE_IP?.trim() ??
      process.env.LIBRETRANSLATE_HOST?.trim();
    const port = process.env.LIBRETRANSLATE_PORT?.trim();
    const protocol = process.env.LIBRETRANSLATE_PROTOCOL?.trim() || "http";
    const baseUrl =
      configBaseUrl ||
      (host && port ? `${protocol}://${host}:${port}` : "unconfigured");

    return {
      ok: false,
      latencyMs: Date.now() - started,
      baseUrl,
      apiKeyConfigured: Boolean(process.env.LIBRETRANSLATE_API_KEY?.trim()),
      missingLanguages: [...requiredLanguages],
      message: `LibreTranslate health check failed: ${(err as Error).message}`,
    };
  }
}

// ── In-memory translation cache ───────────────────────────────────────────────

const cache = new Map<string, string>();
const MAX_CACHE_SIZE = 500;

function cacheSet(key: string, value: string): void {
  if (cache.size >= MAX_CACHE_SIZE) {
    // Evict the oldest entry (Map preserves insertion order).
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
}

// ── Exported helpers ──────────────────────────────────────────────────────────

/**
 * Translates text to the given language code.
 * Results are cached for the lifetime of the process.
 */
export async function translateText(
  text: string,
  targetLang: string,
): Promise<string> {
  if (!text.trim()) return text;

  const normalizedTarget = normalizeLanguageCode(targetLang);
  if (!isLanguageSupported(normalizedTarget)) {
    throw new Error(`Unsupported target language: "${targetLang}"`);
  }

  const key = `${text}::${normalizedTarget}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  try {
    const client = getHttpClient();
    const payload = withApiKey({
      q: text,
      source: "auto",
      target: normalizedTarget,
      format: "text",
    });

    const { data } = await client.post<LibreTranslateResponse>(
      "/translate",
      payload,
    );
    const translated = data?.translatedText;
    if (typeof translated !== "string") {
      throw new Error("Invalid translate response shape.");
    }

    cacheSet(key, translated);
    return translated;
  } catch (err) {
    console.error(
      `[translate] Failed to translate to ${normalizedTarget}:`,
      err,
    );
    throw new Error(
      `Translation to "${normalizedTarget}" failed: ${(err as Error).message}`,
    );
  }
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

// ── Supported language codes ──────────────────────────────────────────────────

const SUPPORTED_LANGS: ReadonlySet<SupportedLanguage> = new Set([
  "en",
  "ru",
  "de",
]);

/** Returns true if the given code is currently enabled in this bot. */
export function isLanguageSupported(code: string): boolean {
  const normalized = normalizeLanguageCode(code);
  return SUPPORTED_LANGS.has(normalized as SupportedLanguage);
}
