import { describe, expect, it } from "vitest";
import { restoreProtectedText, segmentProtectedText, splitDiscordMessages, tokenizeProtectedText } from "../src/services/translationFormatter.js";

describe("translation formatter", () => {
  it("protects inline and fenced code", () => {
    const original = "hello `const x = 1`\n```ts\nconsole.log(x)\n```";
    const tokenized = tokenizeProtectedText(original);
    expect(tokenized.text).not.toContain("const x = 1");
    expect(restoreProtectedText(tokenized.text, tokenized.tokens)).toBe(original);
  });

  it("segments code and emoji as protected values", () => {
    const original = "Hello 😄 <a:dance:1234567890>\n```ts\nconsole.log('hi')\n```\nworld";
    expect(segmentProtectedText(original)).toEqual([
      { kind: "text", value: "Hello " },
      { kind: "protected", value: "😄" },
      { kind: "text", value: " " },
      { kind: "protected", value: "<a:dance:1234567890>" },
      { kind: "text", value: "\n" },
      { kind: "protected", value: "```ts\nconsole.log('hi')\n```" },
      { kind: "text", value: "\nworld" }
    ]);
  });

  it("protects an unclosed fenced code block through the end of the message", () => {
    const original = "before\n```\nkeep this exactly";
    expect(segmentProtectedText(original)).toEqual([
      { kind: "text", value: "before\n" },
      { kind: "protected", value: "```\nkeep this exactly" }
    ]);
  });

  it("protects URLs so translation cannot add spaces inside links", () => {
    const original = "look https://tenor.com/view/whatever-you-say-gif-16431179117705245130 now";
    expect(segmentProtectedText(original)).toEqual([
      { kind: "text", value: "look " },
      { kind: "protected", value: "https://tenor.com/view/whatever-you-say-gif-16431179117705245130" },
      { kind: "text", value: " now" }
    ]);
  });

  it("protects Discord markdown delimiters while leaving inner text translatable", () => {
    const original = "**Important** and ***very important*** plus ~~old~~ and ||secret||";
    expect(segmentProtectedText(original)).toEqual([
      { kind: "protected", value: "**" },
      { kind: "text", value: "Important" },
      { kind: "protected", value: "**" },
      { kind: "text", value: " and " },
      { kind: "protected", value: "***" },
      { kind: "text", value: "very important" },
      { kind: "protected", value: "***" },
      { kind: "text", value: " plus " },
      { kind: "protected", value: "~~" },
      { kind: "text", value: "old" },
      { kind: "protected", value: "~~" },
      { kind: "text", value: " and " },
      { kind: "protected", value: "||" },
      { kind: "text", value: "secret" },
      { kind: "protected", value: "||" }
    ]);
  });

  it("splits long Discord messages", () => {
    const chunks = splitDiscordMessages("a".repeat(4500));
    expect(chunks).toHaveLength(3);
    expect(chunks.every((chunk) => chunk.length <= 2000)).toBe(true);
  });
});
