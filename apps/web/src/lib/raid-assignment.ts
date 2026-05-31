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
  squad1Power?: number;
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

export function participantSquad1Power(participant: RaidParticipantLike) {
  if (typeof participant.squad1Power === "number") return participant.squad1Power;
  const sq1 = (participant.squadPowers ?? []).find((s) => s.squadIndex === 1);
  return sq1 ? Number(sq1.power) : 0;
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

export function compareParticipantsBySquad1Power(a: RaidParticipantLike, b: RaidParticipantLike) {
  return (
    participantSquad1Power(b) - participantSquad1Power(a) ||
    participantTotalPower(b) - participantTotalPower(a) ||
    a.username.localeCompare(b.username)
  );
}

export const FIXED_OBJECTIVE_COUNTS: Record<string, number> = {
  central_reservoir: 2,
  water_treatment_1: 3,
  water_treatment_2: 3,
};

export function getAutoAssignDefaultCounts(objectives: RaidObjectiveLike[], totalPlayers: number) {
  const assignable = objectives.filter((o) => o.isAssignable).sort(compareObjectivesByPriority);
  if (assignable.length === 0 || totalPlayers <= 0) return [];

  const fixedObjectives = assignable.filter((o) => o.key in FIXED_OBJECTIVE_COUNTS);
  const remainingObjectives = assignable.filter((o) => !(o.key in FIXED_OBJECTIVE_COUNTS));

  const fixedTotal = fixedObjectives.reduce((sum, o) => sum + FIXED_OBJECTIVE_COUNTS[o.key], 0);
  const playersForRemaining = Math.max(0, totalPlayers - fixedTotal);
  const remainingCount = remainingObjectives.length;

  const base = remainingCount > 0 ? Math.floor(playersForRemaining / remainingCount) : 0;
  const leftover = remainingCount > 0 ? playersForRemaining % remainingCount : 0;

  const result: { objectiveId: string; count: number }[] = [];

  for (const o of fixedObjectives) {
    result.push({ objectiveId: o.id, count: FIXED_OBJECTIVE_COUNTS[o.key] });
  }

  for (let i = 0; i < remainingObjectives.length; i++) {
    result.push({ objectiveId: remainingObjectives[i].id, count: base + (i < leftover ? 1 : 0) });
  }

  return result;
}

