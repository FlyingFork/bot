import { prisma, type LeaderboardType } from "@tiles-survive/database";
import {
  PHASE4_LEADERBOARD_TYPES,
  STALE_THRESHOLD_FIELDS,
  daysSince,
  healthStatus,
  numberFromEntryData,
  type HealthStatus,
  type Phase4LeaderboardType,
} from "@/lib/phase4-shared";

export type UploadHealth = {
  type: Phase4LeaderboardType;
  capturedAt: Date | null;
  daysSinceLastSnapshot: number | null;
  threshold: number;
  status: HealthStatus;
};

type SettingsLike = Record<string, unknown>;

function thresholdFor(settings: SettingsLike | null | undefined, type: Phase4LeaderboardType) {
  const value = settings?.[STALE_THRESHOLD_FIELDS[type]];
  return typeof value === "number" && Number.isFinite(value) ? value : 7;
}

export async function getUploadHealth(): Promise<UploadHealth[]> {
  const [settings, snapshots] = await Promise.all([
    prisma.allianceSettings.upsert({ where: { id: "primary" }, update: {}, create: { id: "primary" } }),
    Promise.all(
      PHASE4_LEADERBOARD_TYPES.map((type) =>
        prisma.leaderboardSnapshot.findFirst({
          where: { type },
          orderBy: { capturedAt: "desc" },
          select: { capturedAt: true },
        }),
      ),
    ),
  ]);

  return PHASE4_LEADERBOARD_TYPES.map((type, index) => {
    const capturedAt = snapshots[index]?.capturedAt ?? null;
    const threshold = thresholdFor(settings, type);
    const delta = daysSince(capturedAt);
    return {
      type,
      capturedAt,
      daysSinceLastSnapshot: delta,
      threshold,
      status: healthStatus(delta, threshold),
    };
  });
}

export function latestPowerFromEntryData(data: unknown): number | null {
  return numberFromEntryData(data, ["totalPower", "value"]);
}

export async function getContributionScores(memberIds?: string[]) {
  const members = await prisma.allianceMember.findMany({
    where: memberIds ? { id: { in: memberIds } } : undefined,
    select: { id: true, joinedAt: true },
  });
  const ids = members.map((member) => member.id);
  if (ids.length === 0) return new Map<string, ContributionScore>();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
  const settings = await prisma.allianceSettings.upsert({
    where: { id: "primary" },
    update: {},
    create: { id: "primary" },
  });

  const [latestEntries, olderEntries, endedDuels, endedRaids] = await Promise.all([
    prisma.leaderboardEntry.findMany({
      where: {
        memberId: { in: ids },
        snapshot: { type: { in: ["SOLO_POWER", "ALLIANCE_PLAYER_LIST"] } },
      },
      include: { snapshot: { select: { capturedAt: true, type: true } } },
      orderBy: { snapshot: { capturedAt: "desc" } },
    }),
    prisma.leaderboardEntry.findMany({
      where: {
        memberId: { in: ids },
        snapshot: {
          type: { in: ["SOLO_POWER", "ALLIANCE_PLAYER_LIST"] },
          capturedAt: { lte: thirtyDaysAgo },
        },
      },
      include: { snapshot: { select: { capturedAt: true, type: true } } },
      orderBy: { snapshot: { capturedAt: "desc" } },
    }),
    prisma.allianceDuelInstance.findMany({
      where: { status: "ENDED" },
      include: {
        days: {
          include: {
            scores: { where: { memberId: { in: ids }, points: { gt: BigInt(0) } }, select: { memberId: true } },
          },
        },
      },
    }),
    prisma.reservoirRaidPlan.findMany({
      where: { status: "ENDED" },
      include: {
        participants: {
          where: {
            memberId: { in: ids },
            registrationStatus: { in: ["SELECTED_PARTICIPANT", "SELECTED_RESERVIST"] },
          },
          select: { memberId: true },
        },
      },
    }),
  ]);

  const latestByMember = new Map<string, number>();
  const olderByMember = new Map<string, number>();
  for (const entry of latestEntries) {
    if (!entry.memberId || latestByMember.has(entry.memberId)) continue;
    const value = latestPowerFromEntryData(entry.data);
    if (value !== null) latestByMember.set(entry.memberId, value);
  }
  for (const entry of olderEntries) {
    if (!entry.memberId || olderByMember.has(entry.memberId)) continue;
    const value = latestPowerFromEntryData(entry.data);
    if (value !== null) olderByMember.set(entry.memberId, value);
  }

  const growthPercent = new Map<string, number>();
  for (const id of ids) {
    const latest = latestByMember.get(id);
    const older = olderByMember.get(id);
    if (latest !== undefined && older !== undefined && older > 0) {
      growthPercent.set(id, ((latest - older) / older) * 100);
    }
  }
  const bestGrowth = Math.max(0, ...Array.from(growthPercent.values()));

  const result = new Map<string, ContributionScore>();
  for (const member of members) {
    const joinedAt = member.joinedAt;
    const memberDuels = endedDuels.filter((duel) => !joinedAt || duel.startDate >= joinedAt);
    const duelParticipated = memberDuels.filter((duel) =>
      duel.days.some((day) => day.scores.some((score) => score.memberId === member.id)),
    ).length;
    const duelScore = memberDuels.length > 0 ? (duelParticipated / memberDuels.length) * 100 : 50;

    const memberRaids = endedRaids.filter((raid) => !joinedAt || raid.raidDate >= joinedAt);
    const raidParticipated = memberRaids.filter((raid) =>
      raid.participants.some((participant) => participant.memberId === member.id),
    ).length;
    const raidScore = memberRaids.length > 0 ? (raidParticipated / memberRaids.length) * 100 : 50;

    const rawGrowth = growthPercent.get(member.id);
    const powerGrowthScore = rawGrowth === undefined || bestGrowth <= 0 ? 50 : Math.max(0, Math.min(100, (rawGrowth / bestGrowth) * 100));
    const score =
      (powerGrowthScore * settings.contributionWeightPowerGrowth +
        duelScore * settings.contributionWeightDuelParticipation +
        raidScore * settings.contributionWeightRaidParticipation) /
      100;

    result.set(member.id, {
      score: Math.round(score),
      powerGrowthScore: Math.round(powerGrowthScore),
      rawGrowthPercent: rawGrowth ?? null,
      duelScore: Math.round(duelScore),
      raidScore: Math.round(raidScore),
      duelParticipated,
      duelTotal: memberDuels.length,
      raidParticipated,
      raidTotal: memberRaids.length,
      weights: {
        power: settings.contributionWeightPowerGrowth,
        duel: settings.contributionWeightDuelParticipation,
        raid: settings.contributionWeightRaidParticipation,
      },
    });
  }

  return result;
}

export type ContributionScore = {
  score: number;
  powerGrowthScore: number;
  rawGrowthPercent: number | null;
  duelScore: number;
  raidScore: number;
  duelParticipated: number;
  duelTotal: number;
  raidParticipated: number;
  raidTotal: number;
  weights: { power: number; duel: number; raid: number };
};

export function leaderboardTypeForPrisma(type: Phase4LeaderboardType): LeaderboardType {
  return type as LeaderboardType;
}
