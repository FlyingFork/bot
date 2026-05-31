"use client";

import { useState } from "react";
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { AlertTriangle, ChevronDown, ChevronUp, Info, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { RaidObjectiveRow, RaidParticipantRow } from "@/components/phase6/ReservoirRaidDetail";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ObjectiveLang } from "@/lib/raid-objectives";
import { getObjectiveName } from "@/lib/raid-objectives";
import { RaidMap } from "./RaidMap";
import { ParticipantPanel } from "./ParticipantPanel";
import { ObjectiveSheet } from "./ObjectiveSheet";
import { ObjectiveList } from "./ObjectiveList";
import { AutoAssignDialog } from "./AutoAssignDialog";
import { ExportDialog } from "./ExportDialog";
import { useAssignments } from "./useAssignments";

type Props = {
  planId: string;
  raidDate: string;
  startsAt: string;
  objectives: RaidObjectiveRow[];
  participants: RaidParticipantRow[];
  isAdmin: boolean;
  role: string;
  planLang: ObjectiveLang;
};

const EFFECT_KEYS = ["abandoned_helipad", "solar_power_plant", "munitions_plant", "development_complex"] as const;

function ObjectiveEffectsPanel({ planLang }: { planLang: ObjectiveLang }) {
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

export function ObjectivesTab({ planId, raidDate, startsAt, objectives, participants, isAdmin, role, planLang }: Props) {
  const t = useTranslations("phase6.reservoirRaid.objectives");
  const { assign, unassign, autoAssign, resetAssignments, isPending } = useAssignments(planId);

  // Single sheet state used by both desktop (click marker) and mobile (tap marker or list)
  const [sheetObjectiveId, setSheetObjectiveId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const totalAssignments = objectives.reduce((s, o) => s + o.assignments.length, 0);

  const canManage = isAdmin || role === "r4" || role === "r5";
  const isLocked = new Date() >= new Date(startsAt);
  const canEdit = canManage && (isAdmin || !isLocked);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over) return;
    const participantId = active.data.current?.participantId as string | undefined;
    const objectiveId = over.data.current?.objectiveId as string | undefined;
    if (participantId && objectiveId) {
      assign(objectiveId, participantId);
    }
  }

  function openSheet(objectiveId: string) {
    setSheetObjectiveId(objectiveId);
    setSheetOpen(true);
  }

  const sheetObjective = objectives.find((o) => o.id === sheetObjectiveId) ?? null;

  // DndContext wraps EVERYTHING so both desktop and mobile MapMarker (which calls
  // useDroppable) are always inside a valid context, even though mobile DnD is disabled.
  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="space-y-4">
        {/* Tab header — actions only */}
        <div className="flex items-center gap-2 flex-wrap">
          {canEdit && (
            <AutoAssignDialog
              objectives={objectives}
              participants={participants}
              planLang={planLang}
              onApply={autoAssign}
            />
          )}
          <ExportDialog
            planId={planId}
            raidDate={raidDate}
            startsAt={startsAt}
            objectives={objectives}
            participants={participants}
            defaultLang={planLang}
          />
          {canEdit && totalAssignments > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setResetDialogOpen(true)}
              disabled={isPending}
            >
              <Trash2 />
              {t("resetAssignments")}
            </Button>
          )}
        </div>

        {/* Objective bonuses reference */}
        <ObjectiveEffectsPanel planLang={planLang} />

        {/* Lock banner */}
        {canManage && !canEdit && (
          <div className="flex items-center gap-2 rounded-md border border-cn-warning/30 bg-cn-warning/10 px-3 py-2 text-xs text-cn-warning">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Event has started. Assignments are locked.
          </div>
        )}

        {/* Empty state for plans that haven't been seeded yet */}
        {objectives.length === 0 && (
          <div className="rounded-md border border-border-dim bg-raised p-6 text-sm text-text-muted text-center">
            No objectives found. Create a new raid plan to get the full map experience.
          </div>
        )}

        {objectives.length > 0 && (
          <>
            {/* Desktop layout (≥1024px) */}
            <div className="hidden lg:flex gap-4" style={{ minHeight: 480 }}>
              <div className="w-[60%]">
                {/* onMarkerClick opens the same sheet — simple and reliable */}
                <RaidMap
                  objectives={objectives}
                  participants={participants}
                  planLang={planLang}
                  canEdit={canEdit}
                  isPending={isPending}
                  isDesktop={true}
                  onMarkerClick={openSheet}
                  onAssign={assign}
                  onUnassign={unassign}
                />
              </div>
              <div className="w-[40%] overflow-y-auto">
                <ParticipantPanel
                  participants={participants}
                  objectives={objectives}
                  planLang={planLang}
                  canEdit={canEdit}
                />
              </div>
            </div>

            {/* Mobile layout (<1024px) */}
            <div className="lg:hidden space-y-4">
              <RaidMap
                objectives={objectives}
                participants={participants}
                planLang={planLang}
                canEdit={canEdit}
                isPending={isPending}
                isDesktop={false}
                onMarkerClick={openSheet}
                onAssign={assign}
                onUnassign={unassign}
              />
              <ObjectiveList
                objectives={objectives}
                planLang={planLang}
                onSelect={openSheet}
              />
            </div>
          </>
        )}

        {/* Assignment sheet — shared by desktop click and mobile tap */}
        <ObjectiveSheet
          objective={sheetObjective}
          objectives={objectives}
          participants={participants}
          planLang={planLang}
          canEdit={canEdit}
          isPending={isPending}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          onAssign={assign}
          onUnassign={unassign}
        />

        <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("resetConfirmTitle")}</DialogTitle>
              <DialogDescription>
                {t("resetConfirmDescription", { count: totalAssignments })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col-reverse sm:flex-row">
              <Button variant="ghost" onClick={() => setResetDialogOpen(false)} className="w-full sm:w-auto">
                {t("resetCancel")}
              </Button>
              <Button
                variant="destructive"
                disabled={isPending}
                onClick={async () => {
                  setResetDialogOpen(false);
                  await resetAssignments();
                }}
                className="w-full sm:w-auto"
              >
                {t("resetConfirm")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DndContext>
  );
}
