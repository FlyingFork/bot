import prompts from "@/data/alliance-prompts.json";

export type PromptKey = keyof typeof prompts;

export function renderAlliancePrompt(
  key: PromptKey,
  allianceTag?: string | null,
) {
  const definition = prompts[key];
  const format = JSON.stringify(definition.format, null, 2);
  const tag = allianceTag?.trim() || "[CLAN_TAG]";

  return definition.template
    .replace("{JSON_FORMAT}", format)
    .replace(/\[CLAN_TAG\]/g, tag);
}
