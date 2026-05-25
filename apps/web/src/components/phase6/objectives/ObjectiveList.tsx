"use client";

import type { RaidObjectiveRow } from "@/components/phase6/ReservoirRaidDetail";
import { TIER_COLORS, getObjectiveName, type ObjectiveLang } from "@/lib/raid-objectives";

type Props = {
  objectives: RaidObjectiveRow[];
  planLang: ObjectiveLang;
  onSelect: (objectiveId: string) => void;
};

export function ObjectiveList({ objectives, planLang, onSelect }: Props) {
  const assignable = objectives
    .filter((o) => o.isAssignable)
    .sort((a, b) => a.tier - b.tier || b.waterRate - a.waterRate);

  return (
    <div className="divide-y divide-border-subtle rounded-md border border-border-subtle overflow-hidden">
      {assignable.map((obj) => {
        const tierColor = TIER_COLORS[obj.tier as keyof typeof TIER_COLORS];
        const name = getObjectiveName(obj.key, planLang);
        const count = obj.assignments.length;

        return (
          <button
            key={obj.id}
            type="button"
            onClick={() => onSelect(obj.id)}
            className="w-full flex items-center gap-3 px-4 py-3 bg-surface hover:bg-raised text-left transition-colors"
          >
            {/* Tier dot */}
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: tierColor?.text ?? "#6b7fa0" }}
            />

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">{name}</p>
              <p className="text-xs text-text-muted">+{obj.waterRate.toLocaleString()}/min</p>
            </div>

            {count > 0 && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                style={{
                  backgroundColor: tierColor?.bg ?? "rgba(107,127,160,0.12)",
                  color: tierColor?.text ?? "#6b7fa0",
                }}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
