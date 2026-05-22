import type { Locale } from "@/i18n/config";
import type { ObjectiveId, ReservoirRaidObjective } from "@/types/objectives";

export const MAP_IMAGES: Record<Locale, string> = {
  en: "/maps/map_en.png",
  tr: "/maps/map_tr.png",
  ru: "/maps/map_ru.png",
};

// Pin positions are normalized against the shared Reservoir Raid map layout.
export const RESERVOIR_RAID_OBJECTIVES: ReservoirRaidObjective[] = [
  { id: "central-reservoir", tier: "central", ratePerMin: 1800, pinX: 50.8, pinY: 49.9 },
  { id: "water-treatment-center-1", tier: "treatment", ratePerMin: 1200, pinX: 34.8, pinY: 76.4 },
  { id: "water-treatment-center-2", tier: "treatment", ratePerMin: 1200, pinX: 63.9, pinY: 21.9 },
  { id: "water-processing-plant-1", tier: "processing", ratePerMin: 600, pinX: 24.8, pinY: 80.3 },
  { id: "water-processing-plant-2", tier: "processing", ratePerMin: 600, pinX: 75.8, pinY: 18.8 },
  { id: "water-processing-plant-3", tier: "processing", ratePerMin: 600, pinX: 33.3, pinY: 15.9 },
  { id: "water-processing-plant-4", tier: "processing", ratePerMin: 600, pinX: 67.7, pinY: 83.0 },
  { id: "solar-power-plant", tier: "utility", ratePerMin: 240, pinX: 20.6, pinY: 28.0 },
  { id: "development-complex", tier: "utility", ratePerMin: 240, pinX: 38.2, pinY: 35.4 },
  { id: "munitions-plant", tier: "utility", ratePerMin: 240, pinX: 62.6, pinY: 63.6 },
  { id: "abandoned-helipad", tier: "utility", ratePerMin: 240, pinX: 80.2, pinY: 71.8 },
  { id: "water-collectors-north", tier: "collectors", ratePerMin: null, pinX: 49.7, pinY: 23.9 },
  { id: "water-collectors-east", tier: "collectors", ratePerMin: null, pinX: 63.9, pinY: 43.7 },
  { id: "water-collectors-west", tier: "collectors", ratePerMin: null, pinX: 36.7, pinY: 53.9 },
  { id: "water-collectors-south", tier: "collectors", ratePerMin: null, pinX: 49.8, pinY: 74.0 },
];

export const OBJECTIVE_IDS = new Set<ObjectiveId>(
  RESERVOIR_RAID_OBJECTIVES.map((objective) => objective.id),
);

export const OBJECTIVES_BY_ID = new Map(
  RESERVOIR_RAID_OBJECTIVES.map((objective) => [objective.id, objective]),
);
