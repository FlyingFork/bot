"use client";

import { useState } from "react";
import { X, ChevronLeft } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { RaidObjectiveRow, RaidParticipantRow } from "@/components/phase6/ReservoirRaidDetail";
import { TIER_COLORS, getObjectiveName, type ObjectiveLang } from "@/lib/raid-objectives";
import { formatPower } from "@/lib/power";

type Props = {
  objective: RaidObjectiveRow | null;
  participants: RaidParticipantRow[];
  planLang: ObjectiveLang;
  canEdit: boolean;
  isPending: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssign: (objectiveId: string, participantId: string) => void;
  onUnassign: (objectiveId: string, participantId: string) => void;
};

export function ObjectiveSheet({ objective: obj, participants, planLang, canEdit, isPending, open, onOpenChange, onAssign, onUnassign }: Props) {
  const [selectOpen, setSelectOpen] = useState(false);
  const [search, setSearch] = useState("");

  if (!obj) return null;

  const tierColor = obj.tier > 0 ? TIER_COLORS[obj.tier as keyof typeof TIER_COLORS] : null;
  const name = getObjectiveName(obj.key, planLang);

  const assignedIds = new Set(obj.assignments.map((a) => a.participantId));
  const eligible = participants.filter(
    (p) => p.registrationStatus === "SELECTED_PARTICIPANT" || p.registrationStatus === "SELECTED_RESERVIST",
  );
  const unassigned = eligible.filter((p) => !assignedIds.has(p.id));
  const filtered = unassigned.filter((p) => p.username.toLowerCase().includes(search.toLowerCase()));
  const participantsFirst = [
    ...filtered.filter((p) => p.registrationStatus === "SELECTED_PARTICIPANT"),
    ...filtered.filter((p) => p.registrationStatus === "SELECTED_RESERVIST"),
  ];

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="flex flex-col gap-0 p-0 max-h-[75dvh]">
          <SheetHeader className="border-b border-border-subtle">
            <div className="flex items-start justify-between">
              <div>
                <SheetTitle className="text-sm font-semibold">{name}</SheetTitle>
                <p className="text-xs mt-0.5" style={{ color: tierColor?.text ?? "#6b7fa0" }}>
                  Tier {obj.tier} · +{obj.waterRate.toLocaleString()}/min
                </p>
              </div>
              <SheetClose className="text-text-muted hover:text-text-primary">
                <X className="h-4 w-4" />
              </SheetClose>
            </div>
          </SheetHeader>

          <div className="overflow-y-auto flex-1 p-4 space-y-4">
            {/* Assigned list */}
            {obj.assignments.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-text-secondary">Assigned ({obj.assignments.length})</p>
                {obj.assignments.map((a) => (
                  <div key={a.participantId} className="flex items-center justify-between gap-2 rounded-md border border-border-subtle bg-raised px-3 py-2">
                    <div>
                      <p className="text-xs font-medium text-text-primary">{a.playerName}</p>
                      <p className="text-[10px] text-text-muted">
                        {formatPower(a.squad1Power)} · {a.registrationStatus === "SELECTED_PARTICIPANT" ? "Participant" : "Reservist"}
                      </p>
                    </div>
                    {canEdit && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => onUnassign(obj.id, a.participantId)}
                        className="text-text-muted hover:text-cn-danger"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add participant button */}
            {canEdit && unassigned.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => { setSelectOpen(true); setSearch(""); }}
              >
                Add participant
              </Button>
            )}

            {canEdit && unassigned.length === 0 && obj.assignments.length === 0 && (
              <p className="text-xs text-text-muted text-center">No eligible participants available.</p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Full-screen participant select */}
      <Sheet open={selectOpen} onOpenChange={setSelectOpen}>
        <SheetContent side="bottom" className="flex flex-col gap-0 p-0 max-h-[90dvh]">
          <SheetHeader className="border-b border-border-subtle">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setSelectOpen(false)} className="text-text-muted hover:text-text-primary">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <SheetTitle className="text-sm font-semibold">Select participant</SheetTitle>
            </div>
          </SheetHeader>

          <div className="p-3 border-b border-border-subtle">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search participants…"
              autoFocus
              className="w-full h-9 rounded-md border border-border-default bg-raised px-3 text-sm text-text-primary outline-none focus:border-border-active"
            />
          </div>

          <div className="overflow-y-auto flex-1">
            {participantsFirst.map((p) => {
              const squad1 = p.squadPowers.find((s) => s.squadIndex === 1)?.power ?? 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    onAssign(obj.id, p.id);
                    setSelectOpen(false);
                    onOpenChange(false);
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 border-b border-border-subtle hover:bg-raised text-left"
                >
                  <div>
                    <p className="text-sm font-medium text-text-primary">{p.username}</p>
                    <p className="text-xs text-text-muted">
                      {p.registrationStatus === "SELECTED_PARTICIPANT" ? "Participant" : "Reservist"}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums" style={{ color: "#e8a020" }}>
                    {formatPower(squad1)}
                  </span>
                </button>
              );
            })}
            {participantsFirst.length === 0 && (
              <p className="text-sm text-text-muted text-center py-8">No participants found.</p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
