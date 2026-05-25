import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@tiles-survive/database";
import { requireMinRole } from "@/lib/server-auth";
import { jsonSafe } from "@/lib/json";
import { getUploadHealth } from "@/lib/phase4";
import { isPhase4LeaderboardType, PHASE4_LEADERBOARD_TYPES } from "@/lib/phase4-shared";
import { PageHeader } from "@/components/ui/page-header";
import { UploadHealthChips } from "@/components/phase4/UploadHealthChips";
import {
  LeaderboardBrowser,
  type LeaderboardEntryRow,
  type LeaderboardSnapshotRow,
} from "@/components/phase4/LeaderboardBrowser";
import { RankDriftPanel, type RankMover } from "@/components/phase4/RankDriftPanel";

type Props = {
  searchParams: Promise<{ type?: string; snapshot?: string; season?: string }>;
};

export default async function LeaderboardsPage({ searchParams }: Props) {
  await requireMinRole("r4");
  const t = await getTranslations("phase4.leaderboards");
  const params = await searchParams;
  const selectedType = isPhase4LeaderboardType(params.type) ? params.type : PHASE4_LEADERBOARD_TYPES[0];
  const selectedSeasonId = selectedType === "BATTLE_VANGUARD" ? params.season ?? null : null;

  const where = {
    type: selectedType,
    ...(selectedSeasonId ? { seasonId: selectedSeasonId } : {}),
  };

  const [health, snapshots, seasons, driftSnapshots] = await Promise.all([
    getUploadHealth(),
    prisma.leaderboardSnapshot.findMany({
      where,
      orderBy: { capturedAt: "desc" },
      include: {
        season: { select: { id: true, name: true } },
        entries: { select: { id: true } },
      },
      take: 80,
    }),
    prisma.season.findMany({ orderBy: { startDate: "desc" }, select: { id: true, name: true, isActive: true } }),
    prisma.leaderboardSnapshot.findMany({
      where,
      orderBy: { capturedAt: "desc" },
      take: 2,
      include: { entries: { select: { playerName: true, rank: true } } },
    }),
  ]);

  const rankMovers: RankMover[] = [];
  if (driftSnapshots.length >= 2) {
    const current = new Map(
      driftSnapshots[0].entries.filter((e) => e.rank !== null).map((e) => [e.playerName, e.rank as number]),
    );
    const previous = new Map(
      driftSnapshots[1].entries.filter((e) => e.rank !== null).map((e) => [e.playerName, e.rank as number]),
    );
    for (const [name, currRank] of current) {
      const prevRank = previous.get(name);
      if (prevRank === undefined) continue;
      const delta = prevRank - currRank;
      if (delta !== 0) rankMovers.push({ playerName: name, currentRank: currRank, previousRank: prevRank, delta });
    }
    rankMovers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }

  const selectedSnapshotId = params.snapshot ?? snapshots[0]?.id ?? null;
  if (params.snapshot && !snapshots.some((snapshot) => snapshot.id === params.snapshot)) notFound();

  const selectedSnapshot = selectedSnapshotId
    ? await prisma.leaderboardSnapshot.findUnique({
        where: { id: selectedSnapshotId },
        include: {
          entries: {
            include: { member: { select: { username: true } } },
            orderBy: [{ rank: "asc" }, { playerName: "asc" }],
          },
        },
      })
    : null;

  const pendingIds = snapshots.map((snapshot) => snapshot.changeRequestId).filter(Boolean) as string[];
  const pendingChanges = pendingIds.length
    ? await prisma.pendingChange.findMany({
        where: { id: { in: pendingIds } },
        include: { submitter: { select: { username: true, name: true } } },
      })
    : [];
  const submitterByChange = new Map(
    pendingChanges.map((change) => [change.id, change.submitter.username ?? change.submitter.name ?? null]),
  );

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <section className="rounded-md border border-border-subtle bg-surface p-4 space-y-3">
        <h2 className="text-sm font-bold text-text-primary">{t("health")}</h2>
        <UploadHealthChips health={health} />
      </section>
      <RankDriftPanel movers={rankMovers} />
      <LeaderboardBrowser
        selectedType={selectedType}
        selectedSnapshotId={selectedSnapshotId}
        selectedSeasonId={selectedSeasonId}
        snapshots={snapshots.map((snapshot) => ({
          id: snapshot.id,
          type: snapshot.type,
          capturedAt: snapshot.capturedAt.toISOString(),
          entryCount: snapshot.entries.length,
          submitter: snapshot.changeRequestId ? submitterByChange.get(snapshot.changeRequestId) ?? null : null,
          seasonId: snapshot.seasonId,
          seasonName: snapshot.season?.name ?? null,
        })) as LeaderboardSnapshotRow[]}
        entries={jsonSafe(
          selectedSnapshot?.entries.map((entry) => ({
            id: entry.id,
            rank: entry.rank,
            playerName: entry.playerName,
            memberName: entry.member?.username ?? null,
            data: entry.data,
          })) ?? [],
        ) as LeaderboardEntryRow[]}
        seasons={seasons.map((season) => ({ id: season.id, name: season.name, active: season.isActive }))}
      />
    </div>
  );
}
