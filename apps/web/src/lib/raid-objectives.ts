export type ObjectiveLang = "en" | "ru" | "tr";

export const OBJECTIVE_DEFINITIONS = [
  // Tier 1 — Critical
  {
    key: "central_reservoir",
    tier: 1,
    waterRate: 1800,
    isAssignable: true,
    mapX: 50.0,
    mapY: 52.0,
    names: {
      en: "Central Reservoir",
      ru: "Центр. резервуар",
      tr: "Merkezi Rezervuar",
    },
  },
  // Tier 2 — High
  {
    key: "water_treatment_1",
    tier: 2,
    waterRate: 1200,
    isAssignable: true,
    mapX: 35.5,
    mapY: 80.0,
    names: {
      en: "Water Treatment Center 1",
      ru: "Водооч. центр 1",
      tr: "Su Arıtma 1",
    },
  },
  {
    key: "water_treatment_2",
    tier: 2,
    waterRate: 1200,
    isAssignable: true,
    mapX: 64.0,
    mapY: 26.0,
    names: {
      en: "Water Treatment Center 2",
      ru: "Водооч. центр 2",
      tr: "Su Arıtma 2",
    },
  },
  // Tier 3 — Medium
  {
    key: "water_processing_1",
    tier: 3,
    waterRate: 600,
    isAssignable: true,
    mapX: 24.5,
    mapY: 82.0,
    names: {
      en: "Water Processing Plant 1",
      ru: "Водообр. завод 1",
      tr: "Su İşleme 1",
    },
  },
  {
    key: "water_processing_2",
    tier: 3,
    waterRate: 600,
    isAssignable: true,
    mapX: 76.0,
    mapY: 22.0,
    names: {
      en: "Water Processing Plant 2",
      ru: "Водообр. завод 2",
      tr: "Su İşleme 2",
    },
  },
  {
    key: "water_processing_3",
    tier: 3,
    waterRate: 600,
    isAssignable: true,
    mapX: 33.0,
    mapY: 18.0,
    names: {
      en: "Water Processing Plant 3",
      ru: "Водообр. завод 3",
      tr: "Su İşleme 3",
    },
  },
  {
    key: "water_processing_4",
    tier: 3,
    waterRate: 600,
    isAssignable: true,
    mapX: 67.5,
    mapY: 85.0,
    names: {
      en: "Water Processing Plant 4",
      ru: "Водообр. завод 4",
      tr: "Su İşleme 4",
    },
  },
  // Tier 4 — Low
  {
    key: "development_complex",
    tier: 4,
    waterRate: 240,
    isAssignable: true,
    mapX: 37.0,
    mapY: 36.0,
    names: {
      en: "Development Complex",
      ru: "Компл. разработки",
      tr: "Araştırma Kompleksi",
    },
  },
  {
    key: "solar_power_plant",
    tier: 4,
    waterRate: 240,
    isAssignable: true,
    mapX: 20.0,
    mapY: 30.0,
    names: {
      en: "Solar Power Plant",
      ru: "Солн. электр-я",
      tr: "Güneş Enerjisi Santrali",
    },
  },
  {
    key: "munitions_plant",
    tier: 4,
    waterRate: 240,
    isAssignable: true,
    mapX: 63.0,
    mapY: 66.0,
    names: {
      en: "Munitions Plant",
      ru: "Военн. завод",
      tr: "Askeri Fabrika",
    },
  },
  {
    key: "abandoned_helipad",
    tier: 4,
    waterRate: 240,
    isAssignable: true,
    mapX: 79.5,
    mapY: 75.0,
    names: {
      en: "Abandoned Helipad",
      ru: "Заброш. верт. площадка",
      tr: "Terk Edilmiş Helikopter Pisti",
    },
  },
  // Tier 0 — Non-assignable decorative markers
  {
    key: "water_collectors_top",
    tier: 0,
    waterRate: 0,
    isAssignable: false,
    mapX: 44.5,
    mapY: 25.0,
    names: {
      en: "Water Collectors",
      ru: "Водосборники",
      tr: "Su Toplayıcılar",
    },
  },
  {
    key: "water_collectors_left",
    tier: 0,
    waterRate: 0,
    isAssignable: false,
    mapX: 30.5,
    mapY: 55.0,
    names: {
      en: "Water Collectors",
      ru: "Водосборники",
      tr: "Su Toplayıcılar",
    },
  },
  {
    key: "water_collectors_right",
    tier: 0,
    waterRate: 0,
    isAssignable: false,
    mapX: 59.0,
    mapY: 47.0,
    names: {
      en: "Water Collectors",
      ru: "Водосборники",
      tr: "Su Toplayıcılar",
    },
  },
  {
    key: "water_collectors_bottom",
    tier: 0,
    waterRate: 0,
    isAssignable: false,
    mapX: 46.0,
    mapY: 74.0,
    names: {
      en: "Water Collectors",
      ru: "Водосборники",
      tr: "Su Toplayıcılar",
    },
  },
] as const;

export type ObjectiveKey = (typeof OBJECTIVE_DEFINITIONS)[number]["key"];

export const TIER_COLORS = {
  1: {
    text: "#e8a020",
    bg: "rgba(232,160,32,0.12)",
    border: "rgba(232,160,32,0.25)",
  },
  2: {
    text: "#9b7fe8",
    bg: "rgba(155,127,232,0.12)",
    border: "rgba(155,127,232,0.25)",
  },
  3: {
    text: "#4a90d9",
    bg: "rgba(74,144,217,0.12)",
    border: "rgba(74,144,217,0.25)",
  },
  4: {
    text: "#6b7fa0",
    bg: "rgba(107,127,160,0.12)",
    border: "rgba(107,127,160,0.25)",
  },
} as const;

export function getObjectiveName(key: string, lang: ObjectiveLang): string {
  const def = OBJECTIVE_DEFINITIONS.find((d) => d.key === key);
  return def?.names[lang] ?? key;
}

export function getObjectiveDef(key: string) {
  return OBJECTIVE_DEFINITIONS.find((d) => d.key === key) ?? null;
}
