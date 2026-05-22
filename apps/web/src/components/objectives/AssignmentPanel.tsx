"use client";

import { useLocale, useTranslations } from "next-intl";
import { OBJECTIVE_NAMES } from "@/data/objective-names";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import type { ObjectiveId, ObjectiveMember, ReservoirRaidObjective } from "@/types/objectives";
import { PlayerChecklist } from "./PlayerChecklist";

export function ObjectiveRate({ objective }: { objective: ReservoirRaidObjective }) {
  const t = useTranslations("objectives");

  return (
    <span className="text-xs font-bold text-cn-warning">
      {objective.ratePerMin === null
        ? t("collectorRate")
        : t("ratePerMinute", { rate: objective.ratePerMin })}
    </span>
  );
}

export function AssignmentPanel({
  assignedMemberIds,
  getMemberLoad,
  members,
  objective,
  onDone,
  onPlayerNameClick,
  onToggle,
}: {
  assignedMemberIds: Set<string>;
  getMemberLoad: (memberId: string) => number;
  members: ObjectiveMember[];
  objective: ReservoirRaidObjective | null;
  onDone: () => void;
  onPlayerNameClick: (memberId: string) => void;
  onToggle: (objectiveId: ObjectiveId, memberId: string) => void;
}) {
  const locale = useLocale() as Locale;
  const t = useTranslations("objectives");

  if (!objective) {
    return (
      <section className="flex min-h-[18rem] items-center justify-center rounded-lg border border-border-default bg-surface p-6 text-center text-sm text-text-muted">
        {t("selectObjective")}
      </section>
    );
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-lg border border-border-default bg-surface shadow-card md:min-h-[22rem]">
      <header className="flex items-start justify-between gap-3 border-b border-border-dim px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-text-primary">
            {OBJECTIVE_NAMES[objective.id][locale]}
          </h2>
          <ObjectiveRate objective={objective} />
        </div>
        <Button onClick={onDone} size="sm" variant="ghost">
          {t("done")}
        </Button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col p-3">
        <PlayerChecklist
          assignedMemberIds={assignedMemberIds}
          getMemberLoad={getMemberLoad}
          members={members}
          objectiveId={objective.id}
          onPlayerNameClick={onPlayerNameClick}
          onToggle={onToggle}
        />
      </div>
      <footer className="border-t border-border-dim px-4 py-2 text-[11px] text-text-secondary">
        {t("assignedHere", { count: assignedMemberIds.size, total: members.length })}
      </footer>
    </section>
  );
}
