type NumericValue = bigint | number;

function toNumber(n: NumericValue): number {
  return typeof n === "bigint" ? Number(n) : n;
}

export function formatNumberFull(n: NumericValue, locale?: string): string {
  return toNumber(n).toLocaleString(locale);
}

export function formatCompactNumber(n: NumericValue): string {
  const num = toNumber(n);
  if (!Number.isFinite(num)) return String(num);

  const sign = num < 0 ? "-" : "";
  const abs = Math.abs(num);
  if (abs < 1_000) return `${sign}${formatNumberFull(abs)}`;

  const units = [
    { value: 1_000_000_000_000, suffix: "T" },
    { value: 1_000_000_000, suffix: "B" },
    { value: 1_000_000, suffix: "M" },
    { value: 1_000, suffix: "K" },
  ] as const;
  const unit = units.find((item) => abs >= item.value)!;
  const scaled = abs / unit.value;
  const decimals = scaled >= 100 ? 0 : 1;
  return `${sign}${scaled.toFixed(decimals).replace(/\.0$/, "")}${unit.suffix}`;
}

export function formatPower(n: NumericValue): string {
  return formatCompactNumber(n);
}

export function formatPowerFull(n: NumericValue): string {
  return formatNumberFull(n);
}
