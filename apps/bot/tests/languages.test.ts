import { describe, expect, it } from "vitest";
import { parseLanguage, parseLanguageCsv, languageFromEmoji } from "../src/constants/languages.js";

describe("language helpers", () => {
  it("parses aliases", () => {
    expect(parseLanguage("english")).toBe("en");
    expect(parseLanguage("Russian")).toBe("ru");
    expect(parseLanguage("tr")).toBe("tr");
    expect(parseLanguage("spanish")).toBeNull();
  });

  it("parses unique CSV values", () => {
    expect(parseLanguageCsv("english, ru, turkish, english")).toEqual(["en", "ru", "tr"]);
  });

  it("maps flag emoji to languages", () => {
    expect(languageFromEmoji("🇬🇧")).toBe("en");
    expect(languageFromEmoji("🇷🇺")).toBe("ru");
    expect(languageFromEmoji("🇹🇷")).toBe("tr");
  });
});
