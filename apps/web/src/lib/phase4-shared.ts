import { formatCompactNumber } from "@/lib/power";

export const PHASE4_LEADERBOARD_TYPES = [
  "SOLO_POWER",
  "BATTLE_VANGUARD",
  "HEADQUARTERS",
  "HERO",
  "HERO_POWER",
  "BEHEMOTH_RANKINGS",
  "EXPLORATION_RANKINGS",
  "COLLECTION",
] as const;

export type Phase4LeaderboardType = (typeof PHASE4_LEADERBOARD_TYPES)[number];

export type HealthStatus = "fresh" | "warning" | "stale";

export const LEADERBOARD_VALUE_FIELDS: Record<Phase4LeaderboardType, string[]> = {
  SOLO_POWER: ["value"],
  BATTLE_VANGUARD: ["kills"],
  HEADQUARTERS: ["powerPlantLevel", "otherBuildingsLevel"],
  HERO: ["heroName", "heroPower"],
  HERO_POWER: ["totalHeroPower"],
  BEHEMOTH_RANKINGS: ["behemothPower"],
  EXPLORATION_RANKINGS: ["explorationLevel"],
  COLLECTION: ["collectionPower"],
};

export const LEADERBOARD_EXPORT_FIELDS: Record<Phase4LeaderboardType, string[]> = {
  SOLO_POWER: ["rank", "playerName", "value", "allianceTag"],
  BATTLE_VANGUARD: ["rank", "playerName", "kills", "allianceTag"],
  HEADQUARTERS: ["rank", "playerName", "powerPlantLevel", "otherBuildingsLevel", "allianceTag"],
  HERO: ["rank", "playerName", "heroName", "heroPower", "allianceTag"],
  HERO_POWER: ["rank", "playerName", "totalHeroPower", "allianceTag"],
  BEHEMOTH_RANKINGS: ["rank", "playerName", "behemothPower", "allianceTag"],
  EXPLORATION_RANKINGS: ["rank", "playerName", "explorationLevel", "allianceTag"],
  COLLECTION: ["rank", "playerName", "collectionPower", "allianceTag"],
};

export const STALE_THRESHOLD_FIELDS: Record<Phase4LeaderboardType, string> = {
  SOLO_POWER: "staleThresholdSoloPower",
  BATTLE_VANGUARD: "staleThresholdBattleVanguard",
  HEADQUARTERS: "staleThresholdHeadquarters",
  HERO: "staleThresholdHero",
  HERO_POWER: "staleThresholdHeroPower",
  BEHEMOTH_RANKINGS: "staleThresholdBehemoth",
  EXPLORATION_RANKINGS: "staleThresholdExploration",
  COLLECTION: "staleThresholdCollection",
};

export function isPhase4LeaderboardType(value: unknown): value is Phase4LeaderboardType {
  return typeof value === "string" && PHASE4_LEADERBOARD_TYPES.includes(value as Phase4LeaderboardType);
}

export function numberFromEntryData(data: unknown, fields: string[]): number | null {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
  const record = data as Record<string, unknown>;
  for (const field of fields) {
    const value = record[field];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

type DisplayEntryValueOptions = {
  compactNumbers?: boolean;
};

export function displayEntryValue(value: unknown, options: DisplayEntryValueOptions = {}): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    return options.compactNumbers ? formatCompactNumber(value) : String(value);
  }
  if (typeof value === "bigint") return options.compactNumbers ? formatCompactNumber(value) : value.toString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function healthStatus(daysSinceLastSnapshot: number | null, threshold: number): HealthStatus {
  if (daysSinceLastSnapshot === null) return "stale";
  if (daysSinceLastSnapshot <= threshold) return "fresh";
  if (daysSinceLastSnapshot <= threshold * 1.5) return "warning";
  return "stale";
}

export function daysSince(value: string | Date | null | undefined, now = new Date()): number | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000));
}

export function dateInputToUtc(value: unknown): Date | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}
