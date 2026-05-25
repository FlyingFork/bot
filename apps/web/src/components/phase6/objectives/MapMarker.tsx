"use client";

import { useDroppable } from "@dnd-kit/core";
import type { RaidObjectiveRow } from "@/components/phase6/ReservoirRaidDetail";
import { TIER_COLORS, getObjectiveName, type ObjectiveLang } from "@/lib/raid-objectives";

type Props = {
  objective: RaidObjectiveRow;
  planLang: ObjectiveLang;
  canEdit: boolean;
  isDesktop: boolean;
  onClick: () => void;
};

const TIER_BG: Record<number, string> = {
  1: "rgba(38,22,0,0.90)",
  2: "rgba(22,14,38,0.90)",
  3: "rgba(6,16,34,0.90)",
  4: "rgba(12,15,24,0.90)",
};

// Two size presets — desktop and mobile
const D = { circle: 34, rate: 11, rateMin: 7, label: 9,  labelW: 72, badge: 16, badgeFt: 9,  avatar: 16, avatarFt: 7 };
const M = { circle: 22, rate:  8, rateMin: 6, label: 7,  labelW: 54, badge: 11, badgeFt: 6,  avatar: 12, avatarFt: 6 };

export function MapMarker({ objective: obj, planLang, canEdit, isDesktop, onClick }: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: `drop-${obj.id}`,
    data: { objectiveId: obj.id },
    disabled: !obj.isAssignable || !canEdit || !isDesktop,
  });

  // Decorative water-collector markers are hidden — map image is nameless
  if (!obj.isAssignable) return null;

  const S = isDesktop ? D : M;
  const tierColor = TIER_COLORS[obj.tier as keyof typeof TIER_COLORS];
  const name = getObjectiveName(obj.key, planLang);
  const assignedCount = obj.assignments.length;
  const unassigned = assignedCount === 0;

  const rateLabel =
    obj.waterRate >= 1000
      ? `${(obj.waterRate / 1000).toFixed(obj.waterRate % 1000 === 0 ? 0 : 1)}k`
      : String(obj.waterRate);

  return (
    <div
      ref={setNodeRef}
      style={{
        position: "absolute",
        left: `${obj.mapX}%`,
        top: `${obj.mapY}%`,
        transform: "translate(-50%, 0)",
        zIndex: 10,
      }}
      className="group"
    >
      <button
        type="button"
        onClick={onClick}
        title={name}
        className="relative flex flex-col items-center cursor-pointer select-none"
        style={{ gap: 3 }}
      >
        {/* Main circle */}
        <div
          className="relative flex items-center justify-center transition-transform group-hover:scale-110"
          style={{
            width: S.circle,
            height: S.circle,
            borderRadius: "50%",
            background: TIER_BG[obj.tier] ?? "rgba(12,15,24,0.90)",
            border: `2px solid ${tierColor?.text ?? "#6b7fa0"}`,
            boxShadow: isOver
              ? `0 0 0 3px ${tierColor?.text ?? "#6b7fa0"}, 0 2px 10px rgba(0,0,0,0.7)`
              : "0 2px 10px rgba(0,0,0,0.7)",
            animation: unassigned && canEdit ? "pulse-ring 1.5s ease-in-out infinite" : undefined,
            flexShrink: 0,
          }}
        >
          <div className="flex flex-col items-center justify-center leading-none" style={{ gap: 1 }}>
            <span style={{ fontSize: S.rate, fontWeight: 700, color: "#fff" }}>{rateLabel}</span>
            <span style={{ fontSize: S.rateMin, color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>/min</span>
          </div>

          {/* Count badge */}
          {assignedCount > 0 && (
            <span
              className="absolute flex items-center justify-center leading-none"
              style={{
                top: -S.badge * 0.4,
                right: -S.badge * 0.4,
                minWidth: S.badge,
                height: S.badge,
                borderRadius: 9999,
                fontSize: S.badgeFt,
                fontWeight: 700,
                paddingLeft: 2,
                paddingRight: 2,
                backgroundColor: tierColor?.text ?? "#6b7fa0",
                color: "#fff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.6)",
              }}
            >
              {assignedCount}
            </span>
          )}
        </div>

        {/* Name label */}
        <div
          className="truncate text-center leading-none whitespace-nowrap rounded"
          style={{
            maxWidth: S.labelW,
            fontSize: S.label,
            fontWeight: 600,
            paddingLeft: 5,
            paddingRight: 5,
            paddingTop: 2,
            paddingBottom: 2,
            background: "rgba(8,10,16,0.85)",
            border: `1px solid ${tierColor?.text ?? "#6b7fa0"}`,
            color: tierColor?.text ?? "#c0cce0",
            boxShadow: "0 1px 4px rgba(0,0,0,0.6)",
            letterSpacing: "0.01em",
          }}
        >
          {name}
        </div>

        {/* Assigned initials */}
        {assignedCount > 0 && (
          <div className="flex" style={{ marginTop: 1, gap: -S.avatar * 0.25 }}>
            {obj.assignments.slice(0, 3).map((a) => (
              <div
                key={a.participantId}
                className="rounded-full flex items-center justify-center font-bold"
                style={{
                  width: S.avatar,
                  height: S.avatar,
                  fontSize: S.avatarFt,
                  backgroundColor: tierColor?.text ?? "#6b7fa0",
                  color: "#fff",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
                  marginLeft: a === obj.assignments[0] ? 0 : -S.avatar * 0.25,
                }}
                title={a.playerName}
              >
                {a.playerName[0]?.toUpperCase() ?? "?"}
              </div>
            ))}
            {assignedCount > 3 && (
              <div
                className="rounded-full flex items-center justify-center font-bold"
                style={{
                  width: S.avatar,
                  height: S.avatar,
                  fontSize: S.avatarFt,
                  background: "rgba(12,15,24,0.88)",
                  color: "#c0cce0",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
                  marginLeft: -S.avatar * 0.25,
                }}
              >
                +{assignedCount - 3}
              </div>
            )}
          </div>
        )}
      </button>
    </div>
  );
}
