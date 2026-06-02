"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { RaidObjectiveRow, RaidParticipantRow } from "@/components/phase6/ReservoirRaidDetail";
import { compareObjectivesByPriority, getAutoAssignDefaultCounts, FIXED_OBJECTIVE_COUNTS } from "@/lib/raid-assignment";
import { TIER_COLORS, getObjectiveName, type ObjectiveLang } from "@/lib/raid-objectives";
import { formatNumberFull } from "@/lib/power";

type Props = {
  objectives: RaidObjectiveRow[];
  participants: RaidParticipantRow[];
  planLang: ObjectiveLang;
  onApply: (assignments: { objectiveId: string; count: number }[]) => Promise<void>;
};

export function AutoAssignDialog({ objectives, participants, planLang, onApply }: Props) {
  const t = useTranslations("phase6.reservoirRaid.objectives");
  const common = useTranslations("phase6.common");
  const [open, setOpen] = useState(false);
  const [applying, setApplying] = useState(false);

  const eligible = participants.filter(
    (p) => p.registrationStatus === "SELECTED_PARTICIPANT" || p.registrationStatus === "SELECTED_RESERVIST",
  );

  const [counts, setCounts] = useState<Record<string, number>>(() => {
    const defaults = getAutoAssignDefaultCounts(objectives, eligible.length);
    return Object.fromEntries(defaults.map(({ objectiveId, count }) => [objectiveId, count]));
  });

  // Reset counts when dialog opens
  function handleOpen() {
    const defaults = getAutoAssignDefaultCounts(objectives, eligible.length);
    setCounts(Object.fromEntries(defaults.map(({ objectiveId, count }) => [objectiveId, count])));
    setOpen(true);
  }

  async function handleApply() {
    const assignable = objectives
      .filter((o) => o.isAssignable)
      .sort(compareObjectivesByPriority);

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
    .sort(compareObjectivesByPriority);

  const totalAssigned = Object.values(counts).reduce((s, n) => s + n, 0);

  const fixedObjectives = assignable.filter((o) => o.key in FIXED_OBJECTIVE_COUNTS);
  const fixedTotal = fixedObjectives.reduce((s, o) => s + FIXED_OBJECTIVE_COUNTS[o.key], 0);
  const remainingObjectives = assignable.filter((o) => !(o.key in FIXED_OBJECTIVE_COUNTS));
  const playersForRemaining = Math.max(0, eligible.length - fixedTotal);

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleOpen}>
        {t("autoAssign")}
      </Button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-void/60 backdrop-blur-[2px] data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 duration-200" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-lg border border-border-subtle bg-surface shadow-card p-4 space-y-4 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <div className="flex items-start justify-between">
              <div>
                <Dialog.Title className="text-sm font-semibold text-text-primary">{t("autoAssignTitle")}</Dialog.Title>
                <p className="text-xs text-text-muted mt-0.5">
                  {t("autoAssignSummary", { eligible: eligible.length, assigned: totalAssigned })}
                </p>
                {remainingObjectives.length > 0 && (
                  <p className="text-xs text-text-muted mt-0.5 opacity-70">
                    {t("autoAssignRemainingHint", { players: playersForRemaining, objectives: remainingObjectives.length })}
                  </p>
                )}
              </div>
              <Dialog.Close className="text-text-muted hover:text-text-primary">
                <X className="h-4 w-4" />
              </Dialog.Close>
            </div>

            <div className="space-y-1 max-h-80 overflow-y-auto">
              {assignable.map((obj, index) => {
                const tierColor = TIER_COLORS[obj.tier as keyof typeof TIER_COLORS];
                const name = getObjectiveName(obj.key, planLang);
                const showTierHeader = index === 0 || assignable[index - 1]?.tier !== obj.tier;
                return (
                  <div key={obj.id}>
                    {showTierHeader && (
                      <p className="text-[10px] font-semibold uppercase tracking-wide mt-2 mb-1" style={{ color: tierColor?.text }}>
                        {t("exportColumns.tier")} {obj.tier} - +{formatNumberFull(obj.waterRate)}/min
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
              })}
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <Dialog.Close render={<Button variant="ghost" size="sm" />}>{common("cancel")}</Dialog.Close>
              <Button size="sm" disabled={applying} onClick={handleApply}>
                {applying ? t("autoAssignApplying") : t("autoAssignApply")}
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
