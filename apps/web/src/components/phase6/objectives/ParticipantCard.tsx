"use client";

import { useDraggable } from "@dnd-kit/core";
import { Clock, Droplet, Droplets, GripVertical, Trophy } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { RaidObjectiveRow, RaidParticipantRow } from "@/components/phase6/ReservoirRaidDetail";
import { participantSquad1Power, participantTotalPower } from "@/lib/raid-assignment";
import { TIER_COLORS, getObjectiveName, type ObjectiveLang } from "@/lib/raid-objectives";
import { formatPower } from "@/lib/power";

function formatWater(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}

function formatScore(value: number | null) {
  if (value === null) return null;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}

function tierColorClass(tier: "high" | "mid" | "low" | "none") {
  if (tier === "high") return "text-emerald-400";
  if (tier === "mid") return "text-amber-400";
  if (tier === "low") return "text-red-400";
  return "text-text-muted";
}

type Props = {
  participant: RaidParticipantRow;
  assignment: RaidObjectiveRow | undefined;
  planLang: ObjectiveLang;
  canEdit: boolean;
};

export function ParticipantCard({ participant: p, assignment, planLang, canEdit }: Props) {
  const t = useTranslations("phase6");
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: p.id,
    data: { participantId: p.id },
    disabled: !canEdit,
  });

  const isReservist = p.registrationStatus === "SELECTED_RESERVIST";
  const tierColor = assignment ? TIER_COLORS[assignment.tier as keyof typeof TIER_COLORS] : null;
  const objName = assignment ? getObjectiveName(assignment.key, planLang) : null;

  return (
    <div
      ref={setNodeRef}
      className={`flex items-start gap-2 rounded-md border border-border-subtle bg-surface px-3 py-2.5 transition-opacity ${isReservist ? "border-l-[3px] border-l-cn-warning/70" : "border-l-[3px] border-l-transparent"}`}
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      <div className="flex-1 min-w-0 space-y-1">
        {/* Row 1: name + role badge */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-semibold text-text-primary truncate">{p.username}</span>
          {isReservist && (
            <Badge variant="warning" className="text-[10px] px-1.5 py-0">R</Badge>
          )}
        </div>

        {/* Row 2: power + objective */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-bold tabular-nums" style={{ color: "#e8a020" }}>
            {formatPower(participantSquad1Power(p))}
          </span>
          {participantTotalPower(p) > 0 && (
            <span className="text-xs tabular-nums text-text-muted opacity-70">
              · {formatPower(participantTotalPower(p))}
            </span>
          )}
          {objName ? (
            <span
              className="text-[11px] px-1.5 py-0.5 rounded-full font-medium"
              style={{
                color: tierColor?.text ?? "#6b7fa0",
                backgroundColor: tierColor?.bg ?? "rgba(107,127,160,0.12)",
              }}
            >
              {objName}
            </span>
          ) : (
            <span className="text-[11px] px-1.5 py-0.5 rounded-full font-medium text-text-muted bg-raised">
              {t("reservoirRaid.objectives.unassigned")}
            </span>
          )}
        </div>

        {/* Row 3: RRS + composite score */}
        {(p.reservoirRaidScore !== null || p.compositeScore > 0) && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Trophy className="h-2.5 w-2.5 text-text-muted shrink-0" />
            {p.reservoirRaidScore !== null ? (
              <span className={`text-[11px] font-medium tabular-nums ${tierColorClass(p.compositeScoreTier)}`}>
                {formatScore(p.reservoirRaidScore)}
              </span>
            ) : (
              <span className="text-[11px] text-text-muted">—</span>
            )}
            {p.isScoreStale && (
              <span title={t("reservoirRaid.participants.scoreStaleWarning")}>
                <Clock className="h-2.5 w-2.5 text-amber-400 shrink-0" />
              </span>
            )}
            <span className="text-[11px] text-text-muted opacity-60">
              · {p.compositeScore.toFixed(1)}
            </span>
          </div>
        )}

        {/* Row 4: water stats */}
        {(p.lastWaterCollected !== null || p.totalWaterCollected !== null) && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {p.lastWaterCollected !== null && (
              <span className="flex items-center gap-1 rounded-md bg-raised px-2 py-0.5 text-[11px] text-text-muted">
                <Droplet className="h-2.5 w-2.5 text-sky-400 shrink-0" />
                {p.lastWaterCollected.toLocaleString()}
              </span>
            )}
            {p.totalWaterCollected !== null && (
              <span className="flex items-center gap-1 rounded-md bg-raised px-2 py-0.5 text-[11px] text-text-muted">
                <Droplets className="h-2.5 w-2.5 text-sky-400 shrink-0" />
                {formatWater(p.totalWaterCollected)}
              </span>
            )}
          </div>
        )}
      </div>

      {canEdit && (
        <div
          {...attributes}
          {...listeners}
          className="mt-0.5 text-text-muted hover:text-text-primary cursor-grab active:cursor-grabbing shrink-0"
        >
          <GripVertical className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
