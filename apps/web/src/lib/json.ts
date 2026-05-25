export function jsonSafe<T = unknown>(value: unknown): T {
  return JSON.parse(
    JSON.stringify(value, (_key, current) =>
      typeof current === "bigint" ? current.toString() : current,
    ),
  ) as T;
}

export function pickSnapshot<T extends Record<string, unknown>>(
  value: T | null | undefined,
): Record<string, unknown> | undefined {
  if (!value) return undefined;
  return jsonSafe<Record<string, unknown>>(value);
}
