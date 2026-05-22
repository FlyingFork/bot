"use client";

import { cn } from "@/lib/utils";
import type { ReservoirRaidObjective } from "@/types/objectives";

const tierColors = {
  central: "fill-cn-success stroke-cn-success",
  treatment: "fill-cn-cyan stroke-cn-cyan",
  processing: "fill-cn-warning stroke-cn-warning",
  utility: "fill-text-primary stroke-text-primary",
  collectors: "fill-text-secondary stroke-text-secondary",
};

export function MapPin({
  assignedCount,
  objective,
  onClick,
  selected,
  title,
}: {
  assignedCount: number;
  objective: ReservoirRaidObjective;
  onClick: () => void;
  selected: boolean;
  title: string;
}) {
  const alert = assignedCount === 0 && ["central", "treatment"].includes(objective.tier);

  return (
    <g
      aria-label={title}
      className="panzoom-exclude cursor-pointer outline-none"
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      role="button"
      style={{ pointerEvents: "all" }}
      tabIndex={0}
      transform={`translate(${objective.pinX} ${objective.pinY})`}
    >
      <title>{title}</title>
      {alert && (
        <circle
          className="animate-ping fill-cn-warning/30"
          cx="0"
          cy="0"
          r="2.75"
        />
      )}
      <circle
        className={cn(
          "stroke-void stroke-[0.55] drop-shadow-[0_2px_3px_rgba(0,0,0,0.65)]",
          tierColors[objective.tier],
          selected && "stroke-text-primary stroke-[0.8]",
        )}
        cx="0"
        cy="0"
        r={selected ? "2.2" : "1.8"}
      />
      <circle className="fill-void/90" cx="1.8" cy="-1.8" r="1.3" />
      <text
        className="pointer-events-none fill-text-primary text-[2px] font-bold"
        dominantBaseline="central"
        textAnchor="middle"
        x="1.8"
        y="-1.75"
      >
        {assignedCount}
      </text>
    </g>
  );
}
