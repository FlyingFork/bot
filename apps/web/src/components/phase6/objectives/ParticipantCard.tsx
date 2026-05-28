"use client";

import { useDraggable } from "@dnd-kit/core";
import { Droplet, Droplets, GripVertical } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { RaidObjectiveRow, RaidParticipantRow } from "@/components/phase6/ReservoirRaidDetail";
import { participantTotalPower } from "@/lib/raid-assignment";
import { TIER_COLORS, getObjectiveName, type ObjectiveLang } from "@/lib/raid-objectives";
import { formatPower } from "@/lib/power";

function formatWater(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
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
      className="flex items-center gap-2 rounded-md border border-border-subtle bg-surface px-3 py-2 transition-opacity"
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-text-primary truncate">{p.username}</span>
          {isReservist && (
            <Badge variant="warning" className="text-[9px] px-1 py-0">R</Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className="text-[11px] font-semibold tabular-nums" style={{ color: "#e8a020" }}>
            {formatPower(participantTotalPower(p))}
          </span>
          {objName ? (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
              style={{
                color: tierColor?.text ?? "#6b7fa0",
                backgroundColor: tierColor?.bg ?? "rgba(107,127,160,0.12)",
              }}
            >
              {objName}
            </span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium text-text-muted bg-raised">
              {t("reservoirRaid.objectives.unassigned")}
            </span>
          )}
        </div>
        {p.memberId && (
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="flex items-center gap-0.5 text-[10px] text-text-muted">
              <Droplet className="h-2.5 w-2.5 text-sky-400 shrink-0" />
              {p.lastWaterCollected !== null
                ? p.lastWaterCollected.toLocaleString()
                : t("common.unknown")}
            </span>
            <span className="flex items-center gap-0.5 text-[10px] text-text-muted">
              <Droplets className="h-2.5 w-2.5 text-sky-400 shrink-0" />
              {p.totalWaterCollected !== null
                ? formatWater(p.totalWaterCollected)
                : t("common.unknown")}
            </span>
          </div>
        )}
      </div>
      {canEdit && (
        <div
          {...attributes}
          {...listeners}
          className="text-text-muted hover:text-text-primary cursor-grab active:cursor-grabbing shrink-0"
        >
          <GripVertical className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
