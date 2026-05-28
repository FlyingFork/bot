"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import type { RaidObjectiveRow } from "@/components/phase6/ReservoirRaidDetail";
import { TIER_COLORS, getObjectiveName, type ObjectiveLang } from "@/lib/raid-objectives";

const TIER_BG: Record<number, string> = {
  1: "rgba(38,22,0,0.90)",
  2: "rgba(22,14,38,0.90)",
  3: "rgba(6,16,34,0.90)",
  4: "rgba(12,15,24,0.90)",
};

const D = { circle: 34, rate: 11, rateMin: 7, label: 9, labelW: 72 };
const M = { circle: 22, rate: 8, rateMin: 6, label: 7, labelW: 54 };

const EFFECT_KEYS = ["abandoned_helipad", "solar_power_plant", "munitions_plant", "development_complex"] as const;

function EffectsPanel({ planLang }: { planLang: ObjectiveLang }) {
  const t = useTranslations("phase6.reservoirRaid.objectives");
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-md border border-border-dim bg-raised/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors"
      >
        <Info className="h-3.5 w-3.5 shrink-0 text-cn-brand opacity-80" />
        <span className="flex-1">{t("effectsTitle")}</span>
        {open ? <ChevronUp className="h-3.5 w-3.5 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0" />}
      </button>
      {open && (
        <div className="px-3 pb-3 pt-0 space-y-2 border-t border-border-dim">
          {EFFECT_KEYS.map((key) => (
            <div key={key} className="flex items-start gap-2 pt-2 text-xs text-text-secondary">
              <span className="mt-0.5 h-1.5 w-1.5 rounded-full shrink-0 bg-[#6b7fa0]" />
              <div className="leading-relaxed">
                <span className="font-semibold text-text-primary">{getObjectiveName(key, planLang)}</span>
                {" — "}
                {t(`effects.${key}` as `effects.${typeof EFFECT_KEYS[number]}`)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Marker({
  obj,
  planLang,
  isDesktop,
  highlighted,
}: {
  obj: RaidObjectiveRow;
  planLang: ObjectiveLang;
  isDesktop: boolean;
  highlighted: boolean;
}) {
  if (!obj.isAssignable) return null;

  const S = isDesktop ? D : M;
  const tierColor = TIER_COLORS[obj.tier as keyof typeof TIER_COLORS];
  const name = getObjectiveName(obj.key, planLang);
  const rateLabel =
    obj.waterRate >= 1000
      ? `${(obj.waterRate / 1000).toFixed(obj.waterRate % 1000 === 0 ? 0 : 1)}k`
      : String(obj.waterRate);

  const borderColor = highlighted ? "var(--color-gold)" : (tierColor?.text ?? "#6b7fa0");
  const labelColor = highlighted ? "var(--color-gold)" : (tierColor?.text ?? "#c0cce0");
  const circleShadow = highlighted
    ? `0 0 0 3px rgba(232,160,32,0.55), 0 0 18px rgba(232,160,32,0.45), 0 2px 10px rgba(0,0,0,0.7)`
    : "0 2px 10px rgba(0,0,0,0.7)";

  return (
    <div
      style={{
        position: "absolute",
        left: `${obj.mapX}%`,
        top: `${obj.mapY}%`,
        transform: "translate(-50%, 0)",
        zIndex: highlighted ? 20 : 10,
        pointerEvents: "none",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
        {/* Circle — with pulsing ring when highlighted */}
        <div style={{ position: "relative", flexShrink: 0, width: S.circle, height: S.circle }}>
          {highlighted && (
            <div
              className="animate-ping"
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                backgroundColor: "var(--color-gold)",
                opacity: 0.4,
              }}
            />
          )}
          <div
            style={{
              position: "relative",
              width: S.circle,
              height: S.circle,
              borderRadius: "50%",
              background: TIER_BG[obj.tier] ?? "rgba(12,15,24,0.90)",
              border: `2px solid ${borderColor}`,
              boxShadow: circleShadow,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1, gap: 1 }}>
              <span style={{ fontSize: S.rate, fontWeight: 700, color: "#fff" }}>{rateLabel}</span>
              <span style={{ fontSize: S.rateMin, color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>/min</span>
            </div>
          </div>
        </div>

        {/* Name label */}
        <div
          style={{
            maxWidth: S.labelW,
            fontSize: S.label,
            fontWeight: 600,
            padding: "2px 5px",
            background: "rgba(8,10,16,0.85)",
            border: `1px solid ${borderColor}`,
            color: labelColor,
            boxShadow: "0 1px 4px rgba(0,0,0,0.6)",
            letterSpacing: "0.01em",
            borderRadius: 3,
            textAlign: "center" as const,
            whiteSpace: "nowrap" as const,
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {name}
        </div>
      </div>
    </div>
  );
}

function MapView({
  objectives,
  planLang,
  myObjectiveId,
  mobile,
}: {
  objectives: RaidObjectiveRow[];
  planLang: ObjectiveLang;
  myObjectiveId: string | null;
  mobile: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mobile || !ref.current) return;
    let cleanup: (() => void) | undefined;
    import("@panzoom/panzoom").then(({ default: Panzoom }) => {
      if (!ref.current) return;
      const pz = Panzoom(ref.current, { maxScale: 4, contain: "outside" });
      const parent = ref.current.parentElement;
      if (parent) {
        parent.addEventListener("wheel", pz.zoomWithWheel);
        cleanup = () => {
          parent.removeEventListener("wheel", pz.zoomWithWheel);
          pz.destroy();
        };
      }
    });
    return () => cleanup?.();
  }, [mobile]);

  const markers = objectives.map((obj) => (
    <Marker
      key={obj.id}
      obj={obj}
      planLang={planLang}
      isDesktop={!mobile}
      highlighted={obj.id === myObjectiveId}
    />
  ));

  if (mobile) {
    return (
      <div
        className="relative overflow-hidden rounded-md border border-border-subtle"
        style={{ touchAction: "none" }}
      >
        <div ref={ref} className="relative">
          <img src="/map.png" alt="Reservoir Raid map" className="w-full h-auto block" draggable={false} />
          {markers}
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-md border border-border-subtle overflow-hidden">
      <img src="/map.png" alt="Reservoir Raid map" className="w-full h-auto block" draggable={false} />
      {markers}
    </div>
  );
}

export function MemberObjectivesMap({
  objectives,
  planLang,
  myObjectiveId,
}: {
  objectives: RaidObjectiveRow[];
  planLang: ObjectiveLang;
  myObjectiveId: string | null;
}) {
  if (!objectives.some((o) => o.isAssignable)) return null;

  return (
    <div className="space-y-4">
      <EffectsPanel planLang={planLang} />
      {/* Desktop */}
      <div className="hidden lg:block">
        <MapView objectives={objectives} planLang={planLang} myObjectiveId={myObjectiveId} mobile={false} />
      </div>
      {/* Mobile */}
      <div className="lg:hidden">
        <MapView objectives={objectives} planLang={planLang} myObjectiveId={myObjectiveId} mobile={true} />
      </div>
    </div>
  );
}
