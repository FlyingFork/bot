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
  sparkColor = "#e8a020",
  className,
}: StatCardProps) {
  const deltaColors = {
    positive: "text-success",
    negative: "text-danger",
    neutral: "text-muted",
  };

  return (
    <div
      className={cn(
        "bg-surface-2 border border-border-line rounded-[10px] p-3.5 flex flex-col gap-1 lg:py-[20px] lg:px-[24px] lg:min-h-[96px] lg:gap-2",
        className,
      )}
    >
      <span className="text-[11px] font-normal tracking-[0.07em] uppercase text-muted">
        {label}
      </span>
      <span className="text-2xl font-medium text-gold leading-none tabular-nums">
        {value}
      </span>
      {delta && (
        <span className={cn("text-[11px]", deltaColors[deltaType])}>
          {delta}
        </span>
      )}
      {sparkData && sparkData.length > 0 && (
        <Sparkline data={sparkData} color={sparkColor} className="mt-1" />
      )}
    </div>
  );
}
