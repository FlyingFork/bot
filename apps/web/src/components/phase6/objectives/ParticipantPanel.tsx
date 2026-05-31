"use client";

import { useState } from "react";
import { ArrowDownNarrowWide, ArrowUpNarrowWide, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import type { RaidObjectiveRow, RaidParticipantRow } from "@/components/phase6/ReservoirRaidDetail";
import { Input } from "@/components/ui/input";
import {
  compareParticipantsByComposite,
  computePoolMaxValues,
  isEligibleRaidParticipant,
} from "@/lib/raid-assignment";
import type { ObjectiveLang } from "@/lib/raid-objectives";
import { ParticipantCard } from "./ParticipantCard";

type Props = {
  participants: RaidParticipantRow[];
  objectives: RaidObjectiveRow[];
  planLang: ObjectiveLang;
  canEdit: boolean;
};

export function ParticipantPanel({ participants, objectives, planLang, canEdit }: Props) {
  const t = useTranslations("phase6.reservoirRaid.objectives");
  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const assignmentMap = new Map<string, RaidObjectiveRow>();
  for (const obj of objectives) {
    for (const a of obj.assignments) {
      assignmentMap.set(a.participantId, obj);
    }
  }

  const eligible = participants.filter(isEligibleRaidParticipant);
  const { maxRRS, maxSquad1 } = computePoolMaxValues(eligible);

  function sortParticipants(arr: RaidParticipantRow[]) {
    const sorted = [...arr].sort((a, b) => compareParticipantsByComposite(a, b, maxRRS, maxSquad1));
    return sortDir === "asc" ? sorted.reverse() : sorted;
  }

  const query = search.trim().toLowerCase();
  const filteredEligible = eligible
    .filter((p) => p.username.toLowerCase().includes(query) || (p.memberName?.toLowerCase().includes(query) ?? false));

  const mainParticipants = sortParticipants(
    filteredEligible.filter((p) => p.registrationStatus === "SELECTED_PARTICIPANT"),
  );

  const reservists = sortParticipants(
    filteredEligible.filter((p) => p.registrationStatus === "SELECTED_RESERVIST"),
  );

  return (
    <div className="h-full overflow-y-auto space-y-4">
      <div className="sticky top-0 z-10 bg-surface pb-1">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("searchParticipants")}
              className="h-8 pl-8 text-xs"
            />
          </div>
          <button
            type="button"
            onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
            title={t(sortDir === "desc" ? "sortDescending" : "sortAscending")}
            className="shrink-0 rounded-md border border-border-subtle p-1.5 text-text-muted hover:text-text-primary transition-colors"
          >
            {sortDir === "desc" ? (
              <ArrowDownNarrowWide className="h-3.5 w-3.5" />
            ) : (
              <ArrowUpNarrowWide className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {mainParticipants.length > 0 && (
        <section className="space-y-1.5">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide px-1">
            {t("participantCategory")} ({mainParticipants.length})
          </p>
          <div className="space-y-1.5">
            {mainParticipants.map((p) => (
              <ParticipantCard
                key={p.id}
                participant={p}
                assignment={assignmentMap.get(p.id)}
                planLang={planLang}
                canEdit={canEdit}
              />
            ))}
          </div>
        </section>
      )}

      {reservists.length > 0 && (
        <section className="space-y-1.5">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide px-1">
            {t("reservistCategory")} ({reservists.length})
          </p>
          <div className="space-y-1.5">
            {reservists.map((p) => (
              <ParticipantCard
                key={p.id}
                participant={p}
                assignment={assignmentMap.get(p.id)}
                planLang={planLang}
                canEdit={canEdit}
              />
            ))}
          </div>
        </section>
      )}

      {filteredEligible.length === 0 && participants.some(isEligibleRaidParticipant) && (
        <p className="text-xs text-text-muted text-center py-4">{t("noParticipantsFound")}</p>
      )}

      {!participants.some(isEligibleRaidParticipant) && (
        <p className="text-xs text-text-muted text-center py-4">{t("noConfirmedParticipants")}</p>
      )}
    </div>
  );
}
