import type { Locale } from "@/i18n/config";

export type ObjectiveTier =
  | "central"
  | "treatment"
  | "processing"
  | "utility"
  | "collectors";

export type ObjectiveId =
  | "central-reservoir"
  | "water-treatment-center-1"
  | "water-treatment-center-2"
  | "water-processing-plant-1"
  | "water-processing-plant-2"
  | "water-processing-plant-3"
  | "water-processing-plant-4"
  | "water-collectors-north"
  | "water-collectors-east"
  | "water-collectors-west"
  | "water-collectors-south"
  | "solar-power-plant"
  | "development-complex"
  | "munitions-plant"
  | "abandoned-helipad";

export type ObjectiveNameMap = Record<Locale, string>;

export type ReservoirRaidObjective = {
  id: ObjectiveId;
  tier: ObjectiveTier;
  ratePerMin: number | null;
  pinX: number;
  pinY: number;
};

export type ReservoirRaidAssignmentRow = {
  objectiveId: ObjectiveId;
  participantId: string;
};

export type SerializedReservoirRaidPlan = {
  id: string;
  updatedAt: string | null;
  assignments: ReservoirRaidAssignmentRow[];
};

export type ObjectiveMember = {
  id: string;
  username: string;
  memberId: string | null;
  totalSquadPower: string;
  participant: boolean;
  reservist: boolean;
  avatarInitials: string;
  avatarColor: string;
};

export type ExportFormat = "discord" | "plaintext" | "per-player" | "table";
export type ExportLocale = Locale;
