export const locales = ["en", "ru", "tr"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
