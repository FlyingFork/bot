export function formatPower(n: bigint | number): string {
  const num = typeof n === "bigint" ? Number(n) : n;
  if (num < 100_000) return num.toString();
  if (num < 1_000_000) return `${Math.floor(num / 1_000)}K`;
  if (num < 1_000_000_000)
    return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  return `${(num / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
}

export function formatPowerFull(n: bigint | number): string {
  return Number(n).toLocaleString();
}
