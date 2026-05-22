"use client";

import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { OBJECTIVE_NAMES } from "@/data/objective-names";
import { OBJECTIVES_BY_ID, RESERVOIR_RAID_OBJECTIVES } from "@/data/tilessurvive-objectives";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Locale } from "@/i18n/config";
import type { ObjectiveId, ObjectiveMember } from "@/types/objectives";
import { ObjectiveRate } from "./AssignmentPanel";

function useDrawerSide() {
  const [side, setSide] = useState<"bottom" | "right">("bottom");

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const update = () => setSide(media.matches ? "right" : "bottom");

    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return side;
}

export function PlayerDrawer({
  member,
  objectiveIds,
  onOpenChange,
  onToggle,
}: {
  member: ObjectiveMember | null;
  objectiveIds: ObjectiveId[];
  onOpenChange: (open: boolean) => void;
  onToggle: (objectiveId: ObjectiveId, memberId: string) => void;
}) {
  const locale = useLocale() as Locale;
  const t = useTranslations("objectives");
  const commonT = useTranslations("common");
  const side = useDrawerSide();
  const assigned = new Set(objectiveIds);
  const currentObjectives = objectiveIds.flatMap((objectiveId) => {
    const objective = OBJECTIVES_BY_ID.get(objectiveId);
    return objective ? [objective] : [];
  });
  const availableObjectives = RESERVOIR_RAID_OBJECTIVES.filter(
    (objective) => !assigned.has(objective.id),
  );

  return (
    <Sheet onOpenChange={onOpenChange} open={Boolean(member)}>
      <SheetContent className="flex flex-col" side={side}>
        {member && (
          <>
            <SheetHeader className="border-b border-border-dim">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <SheetTitle className="text-sm font-bold text-text-primary">
                    {t("playerAssignments", { username: member.username })}
                  </SheetTitle>
                  <SheetDescription className="text-[11px] text-text-muted">
                    {t("playerLoad", { count: currentObjectives.length })}
                  </SheetDescription>
                </div>
                <SheetClose
                  aria-label={commonT("close")}
                  className="rounded border border-border-default bg-raised p-1 text-text-secondary hover:text-text-primary"
                >
                  <X className="size-4" />
                </SheetClose>
              </div>
            </SheetHeader>
            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
              <section className="flex flex-col gap-2">
                <h3 className="text-xs font-bold text-text-primary">
                  {t("currentAssignments")}
                </h3>
                {currentObjectives.map((objective) => (
                  <div
                    className="flex items-center justify-between gap-2 rounded-md border border-border-default bg-base p-2"
                    key={objective.id}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-text-primary">
                        {OBJECTIVE_NAMES[objective.id][locale]}
                      </p>
                      <ObjectiveRate objective={objective} />
                    </div>
                    <Button
                      aria-label={t("remove")}
                      onClick={() => onToggle(objective.id, member.id)}
                      size="icon-sm"
                      title={t("remove")}
                      variant="ghost"
                    >
                      <X />
                    </Button>
                  </div>
                ))}
                {!currentObjectives.length && (
                  <p className="rounded-md border border-border-dim bg-base p-3 text-xs text-text-muted">
                    {t("noAssignments")}
                  </p>
                )}
              </section>
              <section className="flex flex-col gap-2">
                <h3 className="text-xs font-bold text-text-primary">
                  {t("availableObjectives")}
                </h3>
                {availableObjectives.map((objective) => (
                  <div
                    className="flex items-center justify-between gap-2 rounded-md border border-border-dim bg-surface p-2"
                    key={objective.id}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-text-primary">
                        {OBJECTIVE_NAMES[objective.id][locale]}
                      </p>
                      <ObjectiveRate objective={objective} />
                    </div>
                    <Button
                      aria-label={t("add")}
                      onClick={() => onToggle(objective.id, member.id)}
                      size="icon-sm"
                      title={t("add")}
                      variant="secondary"
                    >
                      <Plus />
                    </Button>
                  </div>
                ))}
                {!availableObjectives.length && (
                  <p className="rounded-md border border-border-dim bg-base p-3 text-xs text-text-muted">
                    {t("allAssigned")}
                  </p>
                )}
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
