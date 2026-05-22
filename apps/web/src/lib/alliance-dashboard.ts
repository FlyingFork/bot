export type DashboardBucket = {
  label: string;
  value: number;
};

export type DashboardPowerTrendPoint = {
  label: string;
  totalPower: number;
  averagePower: number;
  memberCount: number;
};

export type DashboardEventTrendPoint = {
  label: string;
  totalPower: number;
  memberCount: number;
};

export type DashboardMemberPower = {
  currentPower: bigint | null;
  currentPowerPlantLevel: number | null;
  currentRank: string | null;
};

export type DashboardRosterImport = {
  id: string;
  createdAt: Date;
  snapshots: {
    memberId: string;
    power: bigint;
    rank: string;
    member: {
      id: string;
      username: string;
      active: boolean;
    };
  }[];
};

export type DashboardRankTrendPoint = {
  label: string;
  R5: number;
  R4: number;
  R3: number;
  R2: number;
  R1: number;
  unknown: number;
};

export type DashboardRosterChange = {
  id: string;
  username: string;
  prevRank: string | null;
  currRank: string;
  type: "new" | "promoted" | "demoted";
};

export type DashboardMissingMember = {
  id: string;
  username: string;
  lastSeen: Date | null;
};

export type DashboardEventImport = {
  id: string;
  createdAt: Date;
  snapshots: {
    power: bigint;
  }[];
};

const rankOrder = ["R5", "R4", "R3", "R2", "R1"] as const;
function sumPowers(values: bigint[]) {
  return values.reduce((sum, value) => sum + value, BigInt(0));
}

function chartNumber(value: bigint) {
  return Number(value);
}

function importLabel(value: Date, locale?: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

export function summarizeMembers(
  members: DashboardMemberPower[],
  labels = {
    unknown: "Unknown",
    powerPlantLevel: (level: number) => `Level ${level}`,
  },
) {
  let knownPowerCount = 0;
  let totalPower = BigInt(0);
  let unknownRanks = 0;
  let unknownPlantLevels = 0;
  const rankCounts = new Map(rankOrder.map((rank) => [rank, 0]));
  const plantLevelCounts = new Map<number, number>();

  members.forEach((member) => {
    if (member.currentPower !== null) {
      knownPowerCount += 1;
      totalPower += member.currentPower;
    }

    if (member.currentRank && rankCounts.has(member.currentRank as (typeof rankOrder)[number])) {
      const rank = member.currentRank as (typeof rankOrder)[number];
      rankCounts.set(rank, (rankCounts.get(rank) ?? 0) + 1);
    } else {
      unknownRanks += 1;
    }

    if (member.currentPowerPlantLevel === null) {
      unknownPlantLevels += 1;
    } else {
      plantLevelCounts.set(
        member.currentPowerPlantLevel,
        (plantLevelCounts.get(member.currentPowerPlantLevel) ?? 0) + 1,
      );
    }
  });

  const rankDistribution: DashboardBucket[] = rankOrder.map((rank) => ({
    label: rank,
    value: rankCounts.get(rank) ?? 0,
  }));

  if (unknownRanks) {
    rankDistribution.push({ label: labels.unknown, value: unknownRanks });
  }

  const powerPlantDistribution = Array.from(plantLevelCounts.entries())
    .sort(([left], [right]) => left - right)
    .map(([level, value]) => ({ label: labels.powerPlantLevel(level), value }));

  if (unknownPlantLevels) {
    powerPlantDistribution.push({ label: labels.unknown, value: unknownPlantLevels });
  }

  return {
    knownPowerCount,
    totalPower,
    averagePower:
      knownPowerCount > 0 ? totalPower / BigInt(knownPowerCount) : null,
    rankDistribution,
    powerPlantDistribution,
  };
}

export function buildRosterTrend(
  imports: DashboardRosterImport[],
  locale?: string,
) {
  return imports
    .slice()
    .reverse()
    .map((entry) => {
      const totalPower = sumPowers(entry.snapshots.map((snapshot) => snapshot.power));
      const memberCount = entry.snapshots.length;
      const averagePower = memberCount ? totalPower / BigInt(memberCount) : BigInt(0);

      return {
        label: importLabel(entry.createdAt, locale),
        totalPower: chartNumber(totalPower),
        averagePower: chartNumber(averagePower),
        memberCount,
      } satisfies DashboardPowerTrendPoint;
    });
}

export function buildEventTrend(
  imports: DashboardEventImport[],
  locale?: string,
) {
  return imports
    .slice()
    .reverse()
    .map((entry) => ({
      label: importLabel(entry.createdAt, locale),
      totalPower: chartNumber(
        sumPowers(entry.snapshots.map((snapshot) => snapshot.power)),
      ),
      memberCount: entry.snapshots.length,
    }));
}

export function buildRankCompositionTrend(
  imports: DashboardRosterImport[],
  locale?: string,
): DashboardRankTrendPoint[] {
  return imports
    .slice()
    .reverse()
    .map((entry) => {
      const counts: Record<string, number> = { R5: 0, R4: 0, R3: 0, R2: 0, R1: 0 };
      let unknown = 0;
      entry.snapshots.forEach((s) => {
        if (s.rank in counts) {
          counts[s.rank]++;
        } else {
          unknown++;
        }
      });
      return {
        label: importLabel(entry.createdAt, locale),
        R5: counts.R5,
        R4: counts.R4,
        R3: counts.R3,
        R2: counts.R2,
        R1: counts.R1,
        unknown,
      };
    });
}

export function buildPowerBrackets(
  members: { currentPower: bigint | null }[],
  unknownLabel: string,
): DashboardBucket[] {
  const brackets = [
    { label: "<100M", min: 0, max: 100_000_000 },
    { label: "100M–500M", min: 100_000_000, max: 500_000_000 },
    { label: "500M–1B", min: 500_000_000, max: 1_000_000_000 },
    { label: "1B–2B", min: 1_000_000_000, max: 2_000_000_000 },
    { label: ">2B", min: 2_000_000_000, max: Infinity },
  ];

  const counts = brackets.map((b) => ({ label: b.label, value: 0 }));
  let unknownCount = 0;

  members.forEach((m) => {
    if (m.currentPower === null) {
      unknownCount++;
      return;
    }
    const power = Number(m.currentPower);
    const idx = brackets.findIndex((b) => power >= b.min && power < b.max);
    if (idx !== -1) counts[idx].value++;
    else counts[counts.length - 1].value++;
  });

  const result = counts.filter((b) => b.value > 0);
  if (unknownCount) result.push({ label: unknownLabel, value: unknownCount });
  return result;
}

export function findMissingMembers(
  imports: DashboardRosterImport[],
  activeMembers: { id: string; username: string }[],
): DashboardMissingMember[] {
  const [latest, previous] = imports;
  if (!latest) return [];

  const seenIds = new Set(latest.snapshots.map((s) => s.memberId));
  if (previous) previous.snapshots.forEach((s) => seenIds.add(s.memberId));

  const olderImports = imports.slice(2);
  const lastSeenMap = new Map<string, Date>();
  olderImports.forEach((imp) => {
    imp.snapshots.forEach((s) => {
      if (!lastSeenMap.has(s.memberId)) lastSeenMap.set(s.memberId, imp.createdAt);
    });
  });

  return activeMembers
    .filter((m) => !seenIds.has(m.id))
    .map((m) => ({ id: m.id, username: m.username, lastSeen: lastSeenMap.get(m.id) ?? null }));
}

export function findRosterChanges(
  imports: DashboardRosterImport[],
): DashboardRosterChange[] {
  const [latest, previous] = imports;
  if (!latest || !previous) return [];

  const previousRanks = new Map(previous.snapshots.map((s) => [s.memberId, s.rank]));
  const changes: DashboardRosterChange[] = [];

  for (const snapshot of latest.snapshots) {
    if (!snapshot.member.active) continue;
    const prevRank = previousRanks.get(snapshot.memberId) ?? null;
    const currRank = snapshot.rank;

    if (!prevRank) {
      changes.push({ id: snapshot.member.id, username: snapshot.member.username, prevRank: null, currRank, type: "new" });
      continue;
    }

    const prevIdx = rankOrder.indexOf(prevRank as (typeof rankOrder)[number]);
    const currIdx = rankOrder.indexOf(currRank as (typeof rankOrder)[number]);

    if (prevIdx === -1 || currIdx === -1 || prevIdx === currIdx) continue;

    changes.push({
      id: snapshot.member.id,
      username: snapshot.member.username,
      prevRank,
      currRank,
      type: currIdx < prevIdx ? "promoted" : "demoted",
    });
  }

  return changes.sort((a, b) => {
    const priority: Record<string, number> = { promoted: 0, demoted: 1, new: 2 };
    return (priority[a.type] ?? 3) - (priority[b.type] ?? 3);
  });
}

export function findRosterPowerGrowth(imports: DashboardRosterImport[]) {
  const [latest, previous] = imports;

  if (!latest || !previous) {
    return [];
  }

  const previousPowers = new Map(
    previous.snapshots.map((snapshot) => [snapshot.memberId, snapshot.power]),
  );

  return latest.snapshots
    .flatMap((snapshot) => {
      const previousPower = previousPowers.get(snapshot.memberId);

      if (previousPower === undefined || !snapshot.member.active) {
        return [];
      }

      return [
        {
          id: snapshot.member.id,
          username: snapshot.member.username,
          currentPower: snapshot.power,
          previousPower,
          delta: snapshot.power - previousPower,
        },
      ];
    })
    .sort((left, right) => {
      if (left.delta === right.delta) {
        return left.username.localeCompare(right.username);
      }

      return left.delta > right.delta ? -1 : 1;
    });
}
