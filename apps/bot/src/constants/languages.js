export const SUPPORTED_LANGUAGES = ["en", "ru", "tr"];
export const LANGUAGE_LABELS = {
    en: "English",
    ru: "Russian",
    tr: "Turkish"
};
export const LANGUAGE_ALIASES = {
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
export const LANGUAGE_EMOJIS = {
    en: "🇬🇧",
    ru: "🇷🇺",
    tr: "🇹🇷"
};
export const RESPONSE_LANGUAGE_PRIORITY = ["ru", "tr", "en"];
export function isSupportedLanguage(value) {
    return SUPPORTED_LANGUAGES.includes(value);
}
export function parseLanguage(value) {
    return LANGUAGE_ALIASES[value.trim().toLowerCase()] ?? null;
}
export function parseLanguageCsv(value) {
    const parsed = value
        .split(",")
        .map(parseLanguage)
        .filter((language) => language !== null);
    return [...new Set(parsed)];
}
export function languageName(language) {
    return LANGUAGE_LABELS[language];
}
export function languageEmoji(language) {
    return LANGUAGE_EMOJIS[language];
}
export function languageFromEmoji(emoji) {
    return Object.entries(LANGUAGE_EMOJIS).find(([, value]) => value === emoji)?.[0] ?? null;
}
