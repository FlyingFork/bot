"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RaidObjectiveRow, RaidParticipantRow } from "@/components/phase6/ReservoirRaidDetail";
import { TIER_COLORS, getObjectiveName, type ObjectiveLang } from "@/lib/raid-objectives";

type Props = {
  objectives: RaidObjectiveRow[];
  participants: RaidParticipantRow[];
  planLang: ObjectiveLang;
  onApply: (assignments: { objectiveId: string; count: number }[]) => Promise<void>;
};

function computeDefaultCounts(objectives: RaidObjectiveRow[], totalPlayers: number) {
  const assignable = [...objectives]
    .filter((o) => o.isAssignable)
    .sort((a, b) => a.tier - b.tier || b.waterRate - a.waterRate);

  const base = Math.floor(totalPlayers / 11);
  const remainder = totalPlayers % 11;

  return assignable.map((obj, i) => ({
    objectiveId: obj.id,
    count: base + (i < remainder ? 1 : 0),
  }));
}

export function AutoAssignDialog({ objectives, participants, planLang, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [applying, setApplying] = useState(false);

  const eligible = participants.filter(
    (p) => p.registrationStatus === "SELECTED_PARTICIPANT" || p.registrationStatus === "SELECTED_RESERVIST",
  );

  const [counts, setCounts] = useState<Record<string, number>>(() => {
    const defaults = computeDefaultCounts(objectives, eligible.length);
    return Object.fromEntries(defaults.map(({ objectiveId, count }) => [objectiveId, count]));
  });

  // Reset counts when dialog opens
  function handleOpen() {
    const defaults = computeDefaultCounts(objectives, eligible.length);
    setCounts(Object.fromEntries(defaults.map(({ objectiveId, count }) => [objectiveId, count])));
    setOpen(true);
  }

  async function handleApply() {
    const assignable = objectives
      .filter((o) => o.isAssignable)
      .sort((a, b) => a.tier - b.tier || b.waterRate - a.waterRate);

    const assignments = assignable.map((obj) => ({
      objectiveId: obj.id,
      count: counts[obj.id] ?? 0,
    }));

    setApplying(true);
    try {
      await onApply(assignments);
      setOpen(false);
    } finally {
      setApplying(false);
    }
  }

  const assignable = [...objectives]
    .filter((o) => o.isAssignable)
    .sort((a, b) => a.tier - b.tier || b.waterRate - a.waterRate);

  const totalAssigned = Object.values(counts).reduce((s, n) => s + n, 0);

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleOpen}>
        Auto-assign
      </Button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-void/60 backdrop-blur-[2px] data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 duration-200" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-lg border border-border-subtle bg-surface shadow-card p-4 space-y-4 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <div className="flex items-start justify-between">
              <div>
                <Dialog.Title className="text-sm font-semibold text-text-primary">Auto-assign configuration</Dialog.Title>
                <p className="text-xs text-text-muted mt-0.5">
                  {eligible.length} eligible players · {totalAssigned} assigned total
                </p>
              </div>
              <Dialog.Close className="text-text-muted hover:text-text-primary">
                <X className="h-4 w-4" />
              </Dialog.Close>
            </div>

            <div className="space-y-1 max-h-80 overflow-y-auto">
              {(() => {
                let currentTier = -1;
                return assignable.map((obj) => {
                  const tierColor = TIER_COLORS[obj.tier as keyof typeof TIER_COLORS];
                  const name = getObjectiveName(obj.key, planLang);
                  const showTierHeader = obj.tier !== currentTier;
                  currentTier = obj.tier;
                  return (
                    <div key={obj.id}>
                      {showTierHeader && (
                        <p className="text-[10px] font-semibold uppercase tracking-wide mt-2 mb-1" style={{ color: tierColor?.text }}>
                          Tier {obj.tier} — +{obj.waterRate.toLocaleString()}/min
                        </p>
                      )}
                      <div className="flex items-center justify-between gap-3 rounded px-2 py-1.5 hover:bg-raised">
                        <span className="text-xs text-text-primary flex-1 truncate">{name}</span>
                        <input
                          type="number"
                          min={0}
                          max={eligible.length}
                          value={counts[obj.id] ?? 0}
                          onChange={(e) => setCounts((prev) => ({ ...prev, [obj.id]: Math.max(0, parseInt(e.target.value) || 0) }))}
                          className="w-16 h-7 rounded border border-border-default bg-raised px-2 text-xs text-right tabular-nums text-text-primary outline-none focus:border-border-active"
                        />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <Dialog.Close render={<Button variant="ghost" size="sm" />}>Cancel</Dialog.Close>
              <Button size="sm" disabled={applying} onClick={handleApply}>
                {applying ? "Applying…" : "Apply"}
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
