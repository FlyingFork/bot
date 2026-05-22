"use client";

import { Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { OBJECTIVE_NAMES } from "@/data/objective-names";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/config";
import type { ObjectiveMember, ReservoirRaidObjective } from "@/types/objectives";
import { ObjectiveRate } from "./AssignmentPanel";

export function ObjectiveCard({
  assignedMembers,
  objective,
  onClick,
}: {
  assignedMembers: ObjectiveMember[];
  objective: ReservoirRaidObjective;
  onClick: () => void;
}) {
  const locale = useLocale() as Locale;
  const t = useTranslations("objectives");

  return (
    <button
      className={cn(
        "flex w-full flex-col gap-2 rounded-lg border border-border-default bg-surface px-3 py-3 text-left shadow-card transition-colors hover:border-border-active",
        !assignedMembers.length && "border-l-2 border-l-cn-warning",
      )}
      onClick={onClick}
      type="button"
    >
      <span className="flex w-full items-start justify-between gap-2">
        <span className="min-w-0 text-sm font-bold text-text-primary">
          {OBJECTIVE_NAMES[objective.id][locale]}
        </span>
        <ObjectiveRate objective={objective} />
      </span>
      <span className="flex flex-wrap items-center gap-1.5">
        {assignedMembers.slice(0, 4).map((member) => (
          <span
            className="max-w-full truncate rounded border border-border-default bg-base px-1.5 py-0.5 text-[10px] text-text-secondary"
            key={member.id}
          >
            {member.username}
          </span>
        ))}
        {assignedMembers.length > 4 && (
          <span className="text-[10px] font-semibold text-text-muted">
            +{assignedMembers.length - 4}
          </span>
        )}
        <span className="inline-flex items-center gap-1 rounded border border-border-active bg-cn-cyan-dim px-1.5 py-0.5 text-[10px] font-semibold text-cn-cyan">
          <Plus className="size-2.5" />
          {t("addPlayer")}
        </span>
      </span>
    </button>
  );
}
