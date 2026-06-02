"use client";

import { useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { RaidObjectiveRow, RaidParticipantRow } from "@/components/phase6/ReservoirRaidDetail";
import { TIER_COLORS, getObjectiveName, type ObjectiveLang } from "@/lib/raid-objectives";
import { formatNumberFull, formatPower } from "@/lib/power";

type Props = {
  objective: RaidObjectiveRow;
  participants: RaidParticipantRow[];
  planLang: ObjectiveLang;
  canEdit: boolean;
  isPending: boolean;
  onAssign: (objectiveId: string, participantId: string) => void;
  onUnassign: (objectiveId: string, participantId: string) => void;
  trigger: React.ReactNode;
};

export function MarkerPopover({ objective: obj, participants, planLang, canEdit, isPending, onAssign, onUnassign, trigger }: Props) {
  const [search, setSearch] = useState("");
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
    <Popover.Root>
      <Popover.Trigger render={<span />}>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="top" align="center" sideOffset={8}>
          <Popover.Popup
            className="z-50 w-72 rounded-lg border border-border-subtle bg-surface shadow-card p-3 space-y-3 outline-none
              data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95
              data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-text-primary">{name}</p>
                <p className="text-xs" style={{ color: tierColor?.text ?? "#6b7fa0" }}>
                  Tier {obj.tier} · +{formatNumberFull(obj.waterRate)}/min
                </p>
              </div>
              <Popover.Close render={<button />} className="text-text-muted hover:text-text-primary">
                <X className="h-4 w-4" />
              </Popover.Close>
            </div>

            {/* Assigned list */}
            {obj.assignments.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-text-secondary">Assigned ({obj.assignments.length})</p>
                {obj.assignments.map((a) => (
                  <div key={a.participantId} className="flex items-center justify-between gap-2 rounded px-2 py-1 bg-raised">
                    <div className="min-w-0">
                      <span className="text-xs font-medium text-text-primary truncate block">{a.playerName}</span>
                      <span className="text-[10px] text-text-muted">
                        {formatPower(a.squad1Power)} · <span className="opacity-70">{formatPower(a.totalSquadPower)}</span> · {a.registrationStatus === "SELECTED_PARTICIPANT" ? "P" : "R"}
                      </span>
                    </div>
                    {canEdit && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => onUnassign(obj.id, a.participantId)}
                        className="text-text-muted hover:text-cn-danger shrink-0"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add participant */}
            {canEdit && participantsFirst.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-text-secondary">Add participant</p>
                {unassigned.length > 5 && (
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search…"
                    className="w-full h-7 rounded border border-border-default bg-raised px-2 text-xs text-text-primary outline-none focus:border-border-active"
                  />
                )}
                <div className="max-h-40 overflow-y-auto space-y-0.5">
                  {participantsFirst.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      disabled={isPending}
                      onClick={() => { onAssign(obj.id, p.id); setSearch(""); }}
                      className="w-full flex items-center justify-between px-2 py-1 rounded hover:bg-raised text-left"
                    >
                      <span className="text-xs text-text-primary truncate">{p.username}</span>
                      <span className="text-[10px] text-text-muted shrink-0 ml-2">
                        {formatPower(p.squad1Power)} · <span className="opacity-70">{formatPower(p.totalSquadPower)}</span> · {p.registrationStatus === "SELECTED_PARTICIPANT" ? "P" : "R"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {canEdit && unassigned.length === 0 && obj.assignments.length === 0 && (
              <p className="text-xs text-text-muted">No eligible participants available.</p>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
