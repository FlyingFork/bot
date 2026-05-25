"use client";

import type { RaidObjectiveRow, RaidParticipantRow } from "@/components/phase6/ReservoirRaidDetail";
import type { ObjectiveLang } from "@/lib/raid-objectives";
import { ParticipantCard } from "./ParticipantCard";

type Props = {
  participants: RaidParticipantRow[];
  objectives: RaidObjectiveRow[];
  planLang: ObjectiveLang;
  canEdit: boolean;
};

export function ParticipantPanel({ participants, objectives, planLang, canEdit }: Props) {
  const assignmentMap = new Map<string, RaidObjectiveRow>();
  for (const obj of objectives) {
    for (const a of obj.assignments) {
      assignmentMap.set(a.participantId, obj);
    }
  }

  const eligible = participants.filter(
    (p) => p.registrationStatus === "SELECTED_PARTICIPANT" || p.registrationStatus === "SELECTED_RESERVIST",
  );

  const mainParticipants = eligible
    .filter((p) => p.registrationStatus === "SELECTED_PARTICIPANT")
    .sort((a, b) => {
      const aP = a.squadPowers.find((s) => s.squadIndex === 1)?.power ?? 0;
      const bP = b.squadPowers.find((s) => s.squadIndex === 1)?.power ?? 0;
      return bP - aP;
    });

  const reservists = eligible
    .filter((p) => p.registrationStatus === "SELECTED_RESERVIST")
    .sort((a, b) => {
      const aP = a.squadPowers.find((s) => s.squadIndex === 1)?.power ?? 0;
      const bP = b.squadPowers.find((s) => s.squadIndex === 1)?.power ?? 0;
      return bP - aP;
    });

  return (
    <div className="h-full overflow-y-auto space-y-4">
      {mainParticipants.length > 0 && (
        <section className="space-y-1.5">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide px-1">
            Participants ({mainParticipants.length})
          </p>
          <div className="space-y-1">
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
            Reservists ({reservists.length})
          </p>
          <div className="space-y-1">
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

      {eligible.length === 0 && (
        <p className="text-xs text-text-muted text-center py-4">No confirmed participants yet.</p>
      )}
    </div>
  );
}
