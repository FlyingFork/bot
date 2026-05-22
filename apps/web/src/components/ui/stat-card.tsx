"use client";
import { cn } from "@/lib/utils";
import { Sparkline } from "./sparkline";

interface StatCardProps {
  label: string;
  value: string | number;
  delta?: string;
  deltaType?: "positive" | "negative" | "neutral";
  sparkData?: number[];
  sparkColor?: string;
  className?: string;
}

export function StatCard({
  label,
  value,
  delta,
  deltaType = "neutral",
  sparkData,
  sparkColor = "#00D2FF",
  className,
}: StatCardProps) {
  const deltaColors = {
    positive: "text-cn-success",
    negative: "text-cn-danger",
    neutral: "text-text-muted",
  };

  return (
    <div
      className={cn(
        "bg-surface border border-border-dim rounded-md p-3 flex flex-col gap-1",
        className,
      )}
    >
      <span className="text-[10px] font-bold tracking-widest uppercase text-text-muted">
        {label}
      </span>
      <span className="text-2xl font-bold text-text-primary leading-none">
        {value}
      </span>
      {delta && (
        <span
          className={cn("text-[10px] font-semibold", deltaColors[deltaType])}
        >
          {delta}
        </span>
      )}
      {sparkData && sparkData.length > 0 && (
        <Sparkline data={sparkData} color={sparkColor} className="mt-1" />
      )}
    </div>
  );
}
