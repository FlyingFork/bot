type SquadPowerLike = { squadIndex?: number; power: number | bigint | string };

export type RaidObjectiveLike = {
  id: string;
  key: string;
  tier: number;
  waterRate: number;
  isAssignable: boolean;
};

export type RaidParticipantLike = {
  id: string;
  username: string;
  registrationStatus: string;
  totalSquadPower?: number;
  squadPowers?: SquadPowerLike[];
};

export const STRATEGIC_OBJECTIVE_MULTIPLIERS: Record<string, number> = {
  abandoned_helipad: 3,
  solar_power_plant: 4,
  munitions_plant: 4.5,
  development_complex: 4,
};

export function participantTotalPower(participant: RaidParticipantLike) {
  if (typeof participant.totalSquadPower === "number") return participant.totalSquadPower;
  return (participant.squadPowers ?? []).reduce((sum, squad) => sum + Number(squad.power), 0);
}

export function isEligibleRaidParticipant(participant: RaidParticipantLike) {
  return participant.registrationStatus === "SELECTED_PARTICIPANT" || participant.registrationStatus === "SELECTED_RESERVIST";
}

export function objectivePriority(objective: RaidObjectiveLike) {
  return objective.waterRate * (STRATEGIC_OBJECTIVE_MULTIPLIERS[objective.key] ?? 1);
}

export function compareObjectivesByPriority(a: RaidObjectiveLike, b: RaidObjectiveLike) {
  return objectivePriority(b) - objectivePriority(a) || a.tier - b.tier || b.waterRate - a.waterRate || a.key.localeCompare(b.key);
}

export function compareParticipantsByTotalPower(a: RaidParticipantLike, b: RaidParticipantLike) {
  return participantTotalPower(b) - participantTotalPower(a) || a.username.localeCompare(b.username);
}

export function getAutoAssignDefaultCounts(objectives: RaidObjectiveLike[], totalPlayers: number) {
  const assignable = objectives.filter((objective) => objective.isAssignable).sort(compareObjectivesByPriority);
  if (assignable.length === 0 || totalPlayers <= 0) return [];

  const weights = assignable.map((objective) => Math.max(1, objectivePriority(objective)));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const raw = assignable.map((objective, index) => ({
    objectiveId: objective.id,
    count: Math.floor((totalPlayers * weights[index]) / totalWeight),
    remainder: (totalPlayers * weights[index]) / totalWeight - Math.floor((totalPlayers * weights[index]) / totalWeight),
  }));

  let assigned = raw.reduce((sum, row) => sum + row.count, 0);
  for (const row of [...raw].sort((a, b) => b.remainder - a.remainder)) {
    if (assigned >= totalPlayers) break;
    row.count += 1;
    assigned += 1;
  }

  if (totalPlayers >= assignable.length) {
    const zeroRows = raw.filter((row) => row.count === 0);
    for (const zeroRow of zeroRows) {
      const donor = raw
        .filter((row) => row.count > 1)
        .sort((a, b) => b.count - a.count)[0];
      if (!donor) break;
      donor.count -= 1;
      zeroRow.count = 1;
    }
  }

  return raw.map(({ objectiveId, count }) => ({ objectiveId, count }));
}

