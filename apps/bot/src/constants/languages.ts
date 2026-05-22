import type { Language } from "@tiles-survive/database";

export const SUPPORTED_LANGUAGES = ["en", "ru", "tr"] as const satisfies readonly Language[];

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: "English",
  ru: "Russian",
  tr: "Turkish"
};

export const LANGUAGE_ALIASES: Record<string, SupportedLanguage> = {
  en: "en",
  eng: "en",
  english: "en",
  ru: "ru",
  rus: "ru",
  russian: "ru",
  tr: "tr",
  tur: "tr",
  turkish: "tr"
};

export const LANGUAGE_EMOJIS: Record<SupportedLanguage, string> = {
  en: "🇬🇧",
  ru: "🇷🇺",
  tr: "🇹🇷"
};

export const RESPONSE_LANGUAGE_PRIORITY: SupportedLanguage[] = ["ru", "tr", "en"];

export function isSupportedLanguage(value: string): value is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(value as SupportedLanguage);
}

export function parseLanguage(value: string): SupportedLanguage | null {
  return LANGUAGE_ALIASES[value.trim().toLowerCase()] ?? null;
}

export function parseLanguageCsv(value: string): SupportedLanguage[] {
  const parsed = value
    .split(",")
    .map(parseLanguage)
    .filter((language): language is SupportedLanguage => language !== null);
  return [...new Set(parsed)];
}

export function languageName(language: SupportedLanguage): string {
  return LANGUAGE_LABELS[language];
}

export function languageEmoji(language: SupportedLanguage): string {
  return LANGUAGE_EMOJIS[language];
}

export function languageFromEmoji(emoji: string): SupportedLanguage | null {
  return Object.entries(LANGUAGE_EMOJIS).find(([, value]) => value === emoji)?.[0] as SupportedLanguage | undefined ?? null;
}
