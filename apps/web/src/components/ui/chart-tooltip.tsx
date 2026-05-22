interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  locale?: string;
}

export function ChartTooltip({
  active,
  payload,
  label,
  locale,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-raised border border-border-default rounded-md p-2.5 shadow-card text-[11px]">
      {label && (
        <p className="text-[10px] font-bold tracking-widest uppercase text-text-muted mb-2">
          {label}
        </p>
      )}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <div
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: entry.color }}
          />
          <span className="text-text-secondary flex-1">{entry.name}</span>
          <span className="font-bold text-text-primary ml-3">
            {entry.value.toLocaleString(locale)}
          </span>
        </div>
      ))}
    </div>
  );
}
