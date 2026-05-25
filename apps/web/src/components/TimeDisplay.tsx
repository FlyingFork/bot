"use client";

export function TimeDisplay({
  date,
  showDate = true,
}: {
  date: Date;
  showDate?: boolean;
}) {
  const local = showDate ? date.toLocaleString() : date.toLocaleTimeString();
  const utcStr = date.toUTCString().replace(/ GMT$/, " UTC");

  return (
    <span title={`UTC: ${utcStr}`}>
      {local}
      <span className="text-muted-foreground text-xs ml-1">({utcStr})</span>
    </span>
  );
}
