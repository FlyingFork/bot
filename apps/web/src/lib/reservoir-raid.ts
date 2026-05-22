export type ParsedRaidPower =
  | { ok: true; value: bigint }
  | { ok: false; message: "powerFormat" | "powerPrecise" };

const powerMultipliers = {
  K: BigInt(1_000),
  M: BigInt(1_000_000),
};

export function parseRaidPower(value: unknown): ParsedRaidPower {
  if (typeof value !== "string") {
    return { ok: false, message: "powerFormat" };
  }

  const match = value.trim().match(/^(\d+)(?:\.(\d+))?\s*([kKmM])$/);

  if (!match) {
    return { ok: false, message: "powerFormat" };
  }

  const [, whole, fraction = "", rawUnit] = match;
  const scale = BigInt(10) ** BigInt(fraction.length);
  const numerator = BigInt(`${whole}${fraction}`) * powerMultipliers[rawUnit.toUpperCase() as "K" | "M"];

  if (numerator % scale !== BigInt(0)) {
    return { ok: false, message: "powerPrecise" };
  }

  return { ok: true, value: numerator / scale };
}

export function raidDateFromInput(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) {
    return null;
  }

  return date;
}

export function raidStartFromInput(date: Date, value: unknown) {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) {
    return null;
  }

  const [hours, minutes] = value.split(":").map(Number);

  if (hours > 23 || minutes > 59) {
    return null;
  }

  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      hours,
      minutes,
    ),
  );
}

export function isSundayUtc(date: Date) {
  return date.getUTCDay() === 0;
}
