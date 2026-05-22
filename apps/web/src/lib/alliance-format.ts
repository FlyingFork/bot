export function formatPower(
  value?: string | number | bigint | null,
  locale?: string,
  unknown = "Unknown",
) {
  if (value === null || value === undefined || value === "") {
    return unknown;
  }

  return new Intl.NumberFormat(locale).format(
    typeof value === "bigint" ? value : BigInt(value),
  );
}

export function formatImportedAt(
  value?: string | Date | null,
  locale?: string,
  noData = "No data",
) {
  if (!value) {
    return noData;
  }

  return new Date(value).toLocaleString(locale);
}
