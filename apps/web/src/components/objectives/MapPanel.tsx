"use client";

import Image from "next/image";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { MAP_IMAGES, RESERVOIR_RAID_OBJECTIVES } from "@/data/tilessurvive-objectives";
import { OBJECTIVE_NAMES } from "@/data/objective-names";
import { Button } from "@/components/ui/button";
import { useMapPanzoom } from "@/hooks/useMapPanzoom";
import type { Locale } from "@/i18n/config";
import type { ObjectiveId } from "@/types/objectives";
import { MapPin } from "./MapPin";

export function MapPanel({
  assignments,
  onSelect,
  selectedObjectiveId,
}: {
  assignments: Map<ObjectiveId, Set<string>>;
  onSelect: (objectiveId: ObjectiveId) => void;
  selectedObjectiveId: ObjectiveId | null;
}) {
  const t = useTranslations("objectives");
  const locale = useLocale() as Locale;
  const { mapRef, resetView, zoomIn, zoomOut } = useMapPanzoom();

  return (
    <section className="flex w-full min-h-0 self-start flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-[11px] text-text-secondary">
          <span className="font-semibold text-text-primary">{t("legend")}</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-cn-cyan" />
            {t("assigned")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full border border-cn-warning bg-cn-warning/20" />
            {t("unassigned")}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            aria-label={t("zoomOut")}
            onClick={zoomOut}
            size="icon-sm"
            title={t("zoomOut")}
            variant="ghost"
          >
            <Minus />
          </Button>
          <Button
            aria-label={t("zoomIn")}
            onClick={zoomIn}
            size="icon-sm"
            title={t("zoomIn")}
            variant="ghost"
          >
            <Plus />
          </Button>
          <Button
            aria-label={t("resetView")}
            onClick={resetView}
            size="icon-sm"
            title={t("resetView")}
            variant="ghost"
          >
            <RotateCcw />
          </Button>
        </div>
      </div>
      <div className="relative aspect-[1280/739] min-h-0 w-full overflow-hidden rounded-lg border border-border-default bg-base shadow-card">
        <div
          className="relative size-full touch-none select-none"
          ref={mapRef}
        >
          <Image
            alt={t("title")}
            className="size-full object-contain"
            draggable={false}
            height={739}
            priority
            src={MAP_IMAGES[locale]}
            width={1280}
          />
          <svg
            aria-hidden
            className="absolute inset-0 size-full overflow-visible"
            preserveAspectRatio="none"
            viewBox="0 0 100 100"
          >
            {RESERVOIR_RAID_OBJECTIVES.map((objective) => (
              <MapPin
                assignedCount={assignments.get(objective.id)?.size ?? 0}
                key={objective.id}
                objective={objective}
                onClick={() => onSelect(objective.id)}
                selected={selectedObjectiveId === objective.id}
                title={OBJECTIVE_NAMES[objective.id][locale]}
              />
            ))}
          </svg>
        </div>
      </div>
    </section>
  );
}
