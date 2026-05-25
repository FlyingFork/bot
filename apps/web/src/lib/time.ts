export function utcDateString(date: Date = new Date()): string {
  return date.toISOString().split("T")[0];
}

export function toUtcDateString(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function isUtcDayReached(targetDate: Date): boolean {
  return new Date() >= targetDate;
}
