"use client";

import { useState } from "react";
import { ChevronLeft, Droplet, Droplets, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { RaidObjectiveRow, RaidParticipantRow } from "@/components/phase6/ReservoirRaidDetail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { compareParticipantsBySquad1Power, isEligibleRaidParticipant, participantSquad1Power, participantTotalPower } from "@/lib/raid-assignment";
import { formatPower } from "@/lib/power";
import { TIER_COLORS, getObjectiveName, type ObjectiveLang } from "@/lib/raid-objectives";

function formatWater(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}

type Assignment = RaidObjectiveRow["assignments"][number];

type Props = {
  objective: RaidObjectiveRow | null;
  objectives: RaidObjectiveRow[];
  participants: RaidParticipantRow[];
  planLang: ObjectiveLang;
  canEdit: boolean;
  isPending: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssign: (objectiveId: string, participantId: string) => void;
  onUnassign: (objectiveId: string, participantId: string) => void;
};

export function ObjectiveSheet({
  objective: obj,
  objectives,
  participants,
  planLang,
  canEdit,
  isPending,
  open,
  onOpenChange,
  onAssign,
  onUnassign,
}: Props) {
  const t = useTranslations("phase6.reservoirRaid.objectives");
  const [selectOpen, setSelectOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pendingMove, setPendingMove] = useState<RaidParticipantRow | null>(null);

  if (!obj) return null;

  const objective = obj;
  const tierColor = obj.tier > 0 ? TIER_COLORS[obj.tier as keyof typeof TIER_COLORS] : null;
  const name = getObjectiveName(obj.key, planLang);
  const assignmentsByTotalPower = [...obj.assignments].sort((a, b) => b.squad1Power - a.squad1Power || b.totalSquadPower - a.totalSquadPower || a.playerName.localeCompare(b.playerName));

  const participantMap = new Map<string, RaidParticipantRow>(participants.map((p) => [p.id, p]));

  const assignedParticipants = assignmentsByTotalPower.filter((a) => a.registrationStatus === "SELECTED_PARTICIPANT");
  const assignedReservists = assignmentsByTotalPower.filter((a) => a.registrationStatus === "SELECTED_RESERVIST");

  const currentObjectiveIds = new Set(obj.assignments.map((assignment) => assignment.participantId));
  const assignmentMap = new Map<string, RaidObjectiveRow>();
  for (const objective of objectives) {
    for (const assignment of objective.assignments) {
      assignmentMap.set(assignment.participantId, objective);
    }
  }

  const query = search.trim().toLowerCase();
  const eligible = participants.filter(isEligibleRaidParticipant);
  const candidates = eligible
    .filter((participant) => !currentObjectiveIds.has(participant.id))
    .filter(
      (participant) =>
        participant.username.toLowerCase().includes(query) ||
        (participant.memberName?.toLowerCase().includes(query) ?? false),
    );

  const sortBySquad1Power = (rows: RaidParticipantRow[]) => [...rows].sort(compareParticipantsBySquad1Power);
  const recommended = sortBySquad1Power(candidates).slice(0, 3);
  const recommendedIds = new Set(recommended.map((participant) => participant.id));
  const available = sortBySquad1Power(
    candidates.filter((participant) => !recommendedIds.has(participant.id) && !assignmentMap.has(participant.id)),
  );
  const alreadyAssigned = sortBySquad1Power(
    candidates.filter((participant) => !recommendedIds.has(participant.id) && assignmentMap.has(participant.id)),
  );
  const candidateCount = recommended.length + available.length + alreadyAssigned.length;

  function roleLabel(status: string) {
    return status === "SELECTED_PARTICIPANT" ? t("participantRole") : t("reservistRole");
  }

  function selectParticipant(participant: RaidParticipantRow) {
    if (assignmentMap.has(participant.id)) {
      setPendingMove(participant);
      return;
    }
    onAssign(objective.id, participant.id);
    setSelectOpen(false);
    onOpenChange(false);
  }

  function confirmMove() {
    if (!pendingMove) return;
    onAssign(objective.id, pendingMove.id);
    setPendingMove(null);
    setSelectOpen(false);
    onOpenChange(false);
  }

  function renderAssignedCategory(title: string, rows: Assignment[]) {
    if (rows.length === 0) return null;
    return (
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary px-0.5">
          {title} ({rows.length})
        </p>
        {rows.map((assignment) => {
          const fullParticipant = participantMap.get(assignment.participantId);
          return (
            <div
              key={assignment.participantId}
              className="flex items-start justify-between gap-2 rounded-md border border-border-subtle bg-raised px-3 py-2"
            >
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-xs font-semibold text-text-primary">{assignment.playerName}</p>
                <p className="text-sm font-bold tabular-nums" style={{ color: "#e8a020" }}>
                  {formatPower(assignment.squad1Power)}
                  {assignment.totalSquadPower > 0 && (
                    <span className="ml-1 text-xs font-normal text-text-muted opacity-70">· {formatPower(assignment.totalSquadPower)}</span>
                  )}
                </p>
                {fullParticipant?.memberId && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {fullParticipant.lastWaterCollected !== null && (
                      <span className="flex items-center gap-1 rounded-md bg-surface px-2 py-0.5 text-[11px] text-text-muted">
                        <Droplet className="h-2.5 w-2.5 text-sky-400 shrink-0" />
                        {fullParticipant.lastWaterCollected.toLocaleString()}
                      </span>
                    )}
                    {fullParticipant.totalWaterCollected !== null && (
                      <span className="flex items-center gap-1 rounded-md bg-surface px-2 py-0.5 text-[11px] text-text-muted">
                        <Droplets className="h-2.5 w-2.5 text-sky-400 shrink-0" />
                        {formatWater(fullParticipant.totalWaterCollected)}
                      </span>
                    )}
                  </div>
                )}
              </div>
              {canEdit && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => onUnassign(obj!.id, assignment.participantId)}
                  className="mt-0.5 shrink-0 text-text-muted hover:text-cn-danger"
                  aria-label={t("removeAssignment")}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  function renderParticipantButton(participant: RaidParticipantRow) {
    const currentAssignment = assignmentMap.get(participant.id);

    return (
      <button
        key={participant.id}
        type="button"
        disabled={isPending}
        onClick={() => selectParticipant(participant)}
        className="flex w-full items-center justify-between gap-3 border-b border-border-subtle px-4 py-3 text-left hover:bg-raised disabled:opacity-50"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium text-text-primary">{participant.username}</p>
            {currentAssignment && (
              <Badge variant="warning" className="h-4 max-w-full px-1.5 text-[9px] normal-case tracking-normal">
                {t("assignedBadge", { objective: getObjectiveName(currentAssignment.key, planLang) })}
              </Badge>
            )}
          </div>
          <p className="text-xs text-text-muted">{roleLabel(participant.registrationStatus)}</p>
        </div>
        <span className="shrink-0 text-right">
          <span className="text-sm font-semibold tabular-nums" style={{ color: "#e8a020" }}>{formatPower(participantSquad1Power(participant))}</span>
          {participantTotalPower(participant) > 0 && (
            <span className="block text-[10px] text-text-muted opacity-70 tabular-nums">· {formatPower(participantTotalPower(participant))}</span>
          )}
        </span>
      </button>
    );
  }

  function renderParticipantCategory(title: string, rows: RaidParticipantRow[]) {
    if (rows.length === 0) return null;
    return (
      <section>
        <p className="sticky top-0 z-10 border-b border-border-subtle bg-surface px-4 py-2 text-[11px] font-semibold uppercase text-text-secondary">
          {title} ({rows.length})
        </p>
        {rows.map((participant) => renderParticipantButton(participant))}
      </section>
    );
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="flex max-h-[75dvh] flex-col gap-0 p-0">
          <SheetHeader className="border-b border-border-subtle">
            <div className="flex items-start justify-between">
              <div>
                <SheetTitle className="text-sm font-semibold">{name}</SheetTitle>
                <p className="mt-0.5 text-xs" style={{ color: tierColor?.text ?? "#6b7fa0" }}>
                  {t("objectiveMeta", { tier: obj.tier, rate: obj.waterRate.toLocaleString() })}
                </p>
              </div>
              <SheetClose className="text-text-muted hover:text-text-primary">
                <X className="h-4 w-4" />
              </SheetClose>
            </div>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {(assignedParticipants.length > 0 || assignedReservists.length > 0) && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-text-secondary">
                  {t("assignedPlayers")} ({obj.assignments.length})
                </p>
                {renderAssignedCategory(t("participantCategory"), assignedParticipants)}
                {renderAssignedCategory(t("reservistCategory"), assignedReservists)}
              </div>
            )}

            {canEdit && eligible.length > obj.assignments.length && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  setSelectOpen(true);
                  setSearch("");
                }}
              >
                {t("addParticipant")}
              </Button>
            )}

            {canEdit && eligible.length === obj.assignments.length && obj.assignments.length === 0 && (
              <p className="text-center text-xs text-text-muted">{t("noEligibleParticipants")}</p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={selectOpen} onOpenChange={setSelectOpen}>
        <SheetContent side="bottom" className="flex max-h-[90dvh] flex-col gap-0 p-0">
          <SheetHeader className="border-b border-border-subtle">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setSelectOpen(false)} className="text-text-muted hover:text-text-primary">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <SheetTitle className="text-sm font-semibold">{t("selectParticipant")}</SheetTitle>
            </div>
          </SheetHeader>

          <div className="border-b border-border-subtle p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <Input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("searchParticipants")}
                autoFocus
                className="h-9 pl-9"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {renderParticipantCategory(t("recommendedPlayers"), recommended)}
            {renderParticipantCategory(t("availableParticipants"), available)}
            {renderParticipantCategory(t("alreadyAssignedParticipants"), alreadyAssigned)}
            {candidateCount === 0 && <p className="py-8 text-center text-sm text-text-muted">{t("noParticipantsFound")}</p>}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={!!pendingMove} onOpenChange={(nextOpen) => !nextOpen && setPendingMove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("moveConfirmTitle")}</DialogTitle>
            <DialogDescription>
              {pendingMove
                ? t("moveConfirmDescription", {
                    player: pendingMove.username,
                    from: getObjectiveName(assignmentMap.get(pendingMove.id)?.key ?? "", planLang),
                    to: name,
                  })
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col-reverse sm:flex-row">
            <Button variant="ghost" onClick={() => setPendingMove(null)} className="w-full sm:w-auto">
              {t("moveCancel")}
            </Button>
            <Button onClick={confirmMove} disabled={isPending} className="w-full sm:w-auto">
              {t("moveConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
