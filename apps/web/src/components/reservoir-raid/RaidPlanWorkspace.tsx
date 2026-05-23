"use client";

import { MapPinned, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ObjectivesPage } from "@/components/objectives/ObjectivesPage";
import type { ObjectiveMember, SerializedReservoirRaidPlan } from "@/types/objectives";
import { RaidPlayersPanel, type RaidParticipantRow } from "./RaidPlayersPanel";

export type RaidAllianceMember = {
  id: string;
  username: string;
  avatarColor: string;
  avatarInitials: string;
};

export type RaidWorkspacePlan = {
  id: string;
  publicToken: string;
  raidDate: string;
  startsAt: string;
  registrationOpen: boolean;
  assignmentPlan: SerializedReservoirRaidPlan;
};

export function RaidPlanWorkspace({
  allianceMembers,
  members,
  participants,
  plan,
}: {
  allianceMembers: RaidAllianceMember[];
  members: ObjectiveMember[];
  participants: RaidParticipantRow[];
  plan: RaidWorkspacePlan;
}) {
  const t = useTranslations("reservoirRaid.workspace");
  const [view, setView] = useState<"players" | "map">("players");

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="inline-flex w-fit gap-1 rounded-md border border-border-default bg-base p-1">
        <Button
          onClick={() => setView("players")}
          size="sm"
          variant={view === "players" ? "default" : "ghost"}
        >
          <Users />
          {t("players")}
        </Button>
        <Button
          onClick={() => setView("map")}
          size="sm"
          variant={view === "map" ? "default" : "ghost"}
        >
          <MapPinned />
          {t("map")}
        </Button>
      </div>
      {view === "players" ? (
        <RaidPlayersPanel
          allianceMembers={allianceMembers}
          participants={participants}
          plan={plan}
        />
      ) : (
        <ObjectivesPage members={members} plan={plan.assignmentPlan} />
      )}
    </div>
  );
}
