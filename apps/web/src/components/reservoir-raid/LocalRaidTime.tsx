"use client";

export function LocalRaidTime({ startsAt }: { startsAt: string }) {
  return (
    <span>
      {new Intl.DateTimeFormat(undefined, {
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        month: "short",
        timeZoneName: "short",
        year: "numeric",
      }).format(new Date(startsAt))}
    </span>
  );
}
