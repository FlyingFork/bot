"use client";

import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { OBJECTIVES_BY_ID } from "@/data/tilessurvive-objectives";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useObjectiveAssignments } from "@/hooks/useObjectiveAssignments";
import { cn } from "@/lib/utils";
import type {
  ObjectiveId,
  ObjectiveMember,
  SerializedReservoirRaidPlan,
} from "@/types/objectives";
import { AssignmentPanel } from "./AssignmentPanel";
import { ExportModal } from "./ExportModal";
import { MapPanel } from "./MapPanel";
import { ObjectiveListView } from "./ObjectiveListView";
import { PlayerDrawer } from "./PlayerDrawer";
import { ViewToggle } from "./ViewToggle";

export function ObjectivesPage({
  members,
  plan,
}: {
  members: ObjectiveMember[];
  plan: SerializedReservoirRaidPlan;
}) {
  const t = useTranslations("objectives");
  const [view, setView] = useState<"list" | "map">("list");
  const [rosterFilter, setRosterFilter] = useState<"all" | "participant" | "reservist">(
    "all",
  );
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<ObjectiveId | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const assignmentState = useObjectiveAssignments(plan);
  const selectedObjective = selectedObjectiveId
    ? OBJECTIVES_BY_ID.get(selectedObjectiveId) ?? null
    : null;
  const selectedMember =
    members.find((member) => member.id === selectedMemberId) ?? null;
  const filteredMembers = useMemo(
    () =>
      members.filter((member) =>
        rosterFilter === "all"
          ? true
          : rosterFilter === "participant"
            ? member.participant
            : member.reservist,
      ),
    [members, rosterFilter],
  );

  function selectObjective(objectiveId: ObjectiveId) {
    setSelectedObjectiveId(objectiveId);
    setMobileSheetOpen(true);
  }

  const assignmentPanel = (
    <AssignmentPanel
      assignedMemberIds={
        selectedObjectiveId
          ? assignmentState.assignments.get(selectedObjectiveId) ?? new Set<string>()
          : new Set<string>()
      }
      getMemberLoad={assignmentState.getMemberLoad}
      members={filteredMembers}
      objective={selectedObjective}
      onDone={() => {
        setSelectedObjectiveId(null);
        setMobileSheetOpen(false);
      }}
      onPlayerNameClick={setSelectedMemberId}
      onToggle={assignmentState.toggleAssignment}
    />
  );

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
        <div className="md:hidden">
          <ViewToggle onChange={setView} value={view} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 md:justify-end">
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            {t("rosterFilter")}
            <select
              className="h-8 rounded-[4px] border border-border-default bg-raised px-2 text-xs text-text-primary outline-none focus:border-border-active"
              onChange={(event) =>
                setRosterFilter(event.target.value as "all" | "participant" | "reservist")
              }
              value={rosterFilter}
            >
              <option value="all">{t("allRegistered")}</option>
              <option value="participant">{t("participants")}</option>
              <option value="reservist">{t("reservists")}</option>
            </select>
          </label>
          <p
            className={cn(
              "text-[11px] text-text-secondary",
              assignmentState.saveError && "text-cn-danger",
            )}
          >
            {assignmentState.saveError
              ? t("saveError")
              : assignmentState.saving
                ? t("saving")
                : t("saved")}
          </p>
          <Button
            disabled={!assignmentState.assignmentRows.length || assignmentState.saving}
            onClick={() => {
              if (window.confirm(t("resetPlanConfirm"))) {
                assignmentState.resetAssignments();
                setSelectedObjectiveId(null);
                setSelectedMemberId(null);
                setMobileSheetOpen(false);
              }
            }}
            variant="destructive"
          >
            <Trash2 />
            {t("resetPlan")}
          </Button>
          <ExportModal assignments={assignmentState.assignmentRows} members={members} />
        </div>
      </div>
      <div className="md:hidden">
        {view === "list" ? (
          <ObjectiveListView
            assignments={assignmentState.assignments}
            members={filteredMembers}
            onSelect={selectObjective}
          />
        ) : (
          <MapPanel
            assignments={assignmentState.assignments}
            onSelect={selectObjective}
            selectedObjectiveId={selectedObjectiveId}
          />
        )}
      </div>
      <div className="hidden items-start gap-4 md:grid xl:grid-cols-[minmax(0,3fr)_minmax(20rem,2fr)]">
        <MapPanel
          assignments={assignmentState.assignments}
          onSelect={(objectiveId) => setSelectedObjectiveId(objectiveId)}
          selectedObjectiveId={selectedObjectiveId}
        />
        {assignmentPanel}
      </div>
      <Sheet onOpenChange={setMobileSheetOpen} open={mobileSheetOpen}>
        <SheetContent className="flex h-[88dvh] flex-col p-3 md:hidden" side="bottom">
          {assignmentPanel}
        </SheetContent>
      </Sheet>
      <PlayerDrawer
        member={selectedMember}
        objectiveIds={
          selectedMemberId
            ? assignmentState.getObjectivesForMember(selectedMemberId)
            : []
        }
        onOpenChange={(open) => {
          if (!open) {
            setSelectedMemberId(null);
          }
        }}
        onToggle={assignmentState.toggleAssignment}
      />
    </div>
  );
}
