import { UPLOAD_PROMPTS } from "./upload-prompts";

export type UploadKind =
  | "LEADERBOARD_SNAPSHOT"
  | "ALLIANCE_DUEL_DAY"
  | "RESERVOIR_RAID_RESULTS";

export const LEADERBOARD_TYPES = [
  "SOLO_POWER",
  "BATTLE_VANGUARD",
  "HEADQUARTERS",
  "HERO",
  "HERO_POWER",
  "BEHEMOTH_RANKINGS",
  "EXPLORATION_RANKINGS",
  "COLLECTION",
  "ALLIANCE_PLAYER_LIST",
] as const;

export type LeaderboardTypeName = (typeof LEADERBOARD_TYPES)[number];

// Leaderboard types shown in the leaderboard upload dropdown.
// ALLIANCE_PLAYER_LIST is excluded — it is a roster update, not a competitive ranking.
export const LEADERBOARD_TYPES_FOR_DISPLAY = LEADERBOARD_TYPES.filter(
  (type) => type !== "ALLIANCE_PLAYER_LIST",
);

export const UPLOAD_SCHEMA_FIELDS = {
  SOLO_POWER: ["rank", "playerName", "value", "allianceTag"],
  BATTLE_VANGUARD: ["rank", "playerName", "kills", "allianceTag"],
  HEADQUARTERS: [
    "rank",
    "playerName",
    "powerPlantLevel",
    "otherBuildingsLevel",
    "allianceTag",
  ],
  HERO: ["rank", "playerName", "heroName", "heroPower", "allianceTag"],
  HERO_POWER: ["rank", "playerName", "totalHeroPower", "allianceTag"],
  BEHEMOTH_RANKINGS: ["rank", "playerName", "behemothPower", "allianceTag"],
  EXPLORATION_RANKINGS: [
    "rank",
    "playerName",
    "explorationLevel",
    "allianceTag",
  ],
  COLLECTION: ["rank", "playerName", "collectionPower", "allianceTag"],
  ALLIANCE_PLAYER_LIST: ["playerName", "allianceRank", "totalPower"],
  ALLIANCE_DUEL_DAY: ["playerName", "points"],
  RESERVOIR_RAID_RESULTS: ["playerName", "waterCollected"],
} as const;

// Fields that are validated as strings; everything else is validated as a number.
const STRING_FIELD_NAMES = new Set(["playerName", "allianceTag", "heroName", "allianceRank"]);

export type FieldMeta = { name: string; type: "string" | "number" };
export type SchemaDisplay = { fields: FieldMeta[] };

// Auto-generated from UPLOAD_SCHEMA_FIELDS — no manual maintenance needed.
export const UPLOAD_SCHEMA_DISPLAY = Object.fromEntries(
  (Object.entries(UPLOAD_SCHEMA_FIELDS) as [string, readonly string[]][]).map(
    ([key, fieldNames]) => [
      key,
      {
        fields: fieldNames.map((name) => ({
          name,
          type: (STRING_FIELD_NAMES.has(name)
            ? "string"
            : "number") as FieldMeta["type"],
        })),
      },
    ],
  ),
) as { [K in keyof typeof UPLOAD_SCHEMA_FIELDS]: SchemaDisplay };

export const UPLOAD_SCHEMA_EXAMPLES = {
  SOLO_POWER:
    "[{ rank: number, playerName: string, value: number, allianceTag: string }]",
  BATTLE_VANGUARD:
    "[{ rank: number, playerName: string, kills: number, allianceTag: string }]",
  HEADQUARTERS:
    "[{ rank: number, playerName: string, powerPlantLevel: number, otherBuildingsLevel: number, allianceTag: string }]",
  HERO: "[{ rank: number, playerName: string, heroName: string, heroPower: number, allianceTag: string }]",
  HERO_POWER:
    "[{ rank: number, playerName: string, totalHeroPower: number, allianceTag: string }]",
  BEHEMOTH_RANKINGS:
    "[{ rank: number, playerName: string, behemothPower: number, allianceTag: string }]",
  EXPLORATION_RANKINGS:
    "[{ rank: number, playerName: string, explorationLevel: number, allianceTag: string }]",
  COLLECTION:
    "[{ rank: number, playerName: string, collectionPower: number, allianceTag: string }]",
  ALLIANCE_PLAYER_LIST:
    "[{ playerName: string, allianceRank: string, totalPower: number }]",
  ALLIANCE_DUEL_DAY: "[{ playerName: string, points: number }]",
  RESERVOIR_RAID_RESULTS: "[{ playerName: string, waterCollected: number }]",
} as const;

export function schemaForUpload(
  kind: UploadKind,
  leaderboardType?: string | null,
) {
  if (kind === "LEADERBOARD_SNAPSHOT" && leaderboardType) {
    return (
      UPLOAD_SCHEMA_EXAMPLES[
        leaderboardType as keyof typeof UPLOAD_SCHEMA_EXAMPLES
      ] ?? ""
    );
  }
  if (kind === "LEADERBOARD_SNAPSHOT") return "";
  return UPLOAD_SCHEMA_EXAMPLES[kind];
}

// Returns the key used to look up schemas and prompts for a given upload.
// For LEADERBOARD_SNAPSHOT this is the leaderboardType; for other kinds it is the kind itself.
export function schemaKeyForUpload(
  kind: UploadKind,
  leaderboardType?: string | null,
): string | null {
  if (kind === "LEADERBOARD_SNAPSHOT") return leaderboardType ?? null;
  return kind;
}

export function buildUploadPrompt({
  schemaKey,
  allianceTag,
  tempAwayMembers,
}: {
  schemaKey: string | null;
  allianceTag: string;
  tempAwayMembers: { tag: string; playerName: string }[];
}) {
  const schema = schemaKey
    ? (UPLOAD_SCHEMA_EXAMPLES[
        schemaKey as keyof typeof UPLOAD_SCHEMA_EXAMPLES
      ] ?? "")
    : "";
  const tempAwayStr = tempAwayMembers.length
    ? tempAwayMembers.map((m) => `[${m.tag}] ${m.playerName}`).join(", ")
    : "-";
  const template = schemaKey
    ? (UPLOAD_PROMPTS[schemaKey as keyof typeof UPLOAD_PROMPTS] ?? null)
    : null;

  if (!template) {
    return [
      "Parse the attached screenshot and return a JSON array.",
      `Alliance tag to look for: ${allianceTag || "-"}`,
      `Also include members temporarily in: ${tempAwayStr}`,
      `Format: ${schema}`,
      "Return ONLY the JSON array, no other text.",
    ].join("\n");
  }

  return template
    .replace(/\{\{allianceTag\}\}/g, allianceTag || "-")
    .replace(/\{\{tempAwayTags\}\}/g, tempAwayStr)
    .replace(/\{\{schema\}\}/g, schema);
}
