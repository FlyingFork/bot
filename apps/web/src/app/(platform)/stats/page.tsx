import { getTranslations } from "next-intl/server";
import { prisma } from "@tiles-survive/database";
import { getCurrentUser } from "@/lib/server-auth";
import { hasRole } from "@/lib/roles";
import { formatPower } from "@/lib/power";
import { cn } from "@/lib/utils";
import { getContributionScores, getUploadHealth, latestPowerFromEntryData, type ContributionScore } from "@/lib/phase4";
import { UploadHealthChips } from "@/components/phase4/UploadHealthChips";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatsMemberTable, type StatsMemberRow } from "@/components/phase4/StatsMemberTable";

export default async function StatsPage() {
  const t = await getTranslations("phase4.stats");
  const user = await getCurrentUser();
  const isR4Plus = hasRole(user?.role, "r4");
  const allianceMemberId = user?.allianceMemberId ?? null;
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);

  const [latestRoster, previousRoster, activeMembers, tempAwayCount, duelAll, duel30, powerHistory, recentDuels, recentRaids] = await Promise.all([
    prisma.leaderboardSnapshot.findFirst({
      where: { type: "ALLIANCE_PLAYER_LIST" },
      orderBy: { capturedAt: "desc" },
      include: { entries: true },
    }),
    prisma.leaderboardSnapshot.findFirst({
      where: { type: "ALLIANCE_PLAYER_LIST", capturedAt: { lte: sevenDaysAgo } },
      orderBy: { capturedAt: "desc" },
      include: { entries: true },
    }),
    prisma.allianceMember.count({ where: { memberStatus: { notIn: ["LEFT", "TRANSFERRED"] } } }),
    prisma.allianceMember.count({ where: { isTempAway: true } }),
    prisma.allianceDuelInstance.groupBy({ by: ["outcome"], where: { status: "ENDED" }, _count: true }),
    prisma.allianceDuelInstance.groupBy({
      by: ["outcome"],
      where: { status: "ENDED", startDate: { gte: thirtyDaysAgo } },
      _count: true,
    }),
    prisma.leaderboardSnapshot.findMany({
      where: { type: "ALLIANCE_PLAYER_LIST" },
      orderBy: { capturedAt: "desc" },
      take: 8,
      include: { entries: { select: { data: true } } },
    }),
    prisma.allianceDuelInstance.findMany({
      where: { status: "ENDED" },
      orderBy: { startDate: "desc" },
      take: 5,
      select: { id: true, outcome: true },
    }),
    prisma.reservoirRaidPlan.findMany({
      where: { status: "ENDED" },
      orderBy: { raidDate: "desc" },
      take: 2,
      include: { participants: { select: { waterCollected: true } } },
    }),
  ]);

  const latestPowers = (latestRoster?.entries ?? [])
    .map((entry) => latestPowerFromEntryData(entry.data))
    .filter((value): value is number => value !== null);
  const previousPowers = (previousRoster?.entries ?? [])
    .map((entry) => latestPowerFromEntryData(entry.data))
    .filter((value): value is number => value !== null);
  const totalPower = latestPowers.reduce((sum, value) => sum + value, 0);
  const previousTotalPower = previousPowers.reduce((sum, value) => sum + value, 0);
  const averagePower = latestPowers.length > 0 ? Math.round(totalPower / latestPowers.length) : 0;
  const growth = previousTotalPower > 0 ? ((totalPower - previousTotalPower) / previousTotalPower) * 100 : null;

  const recordLabel = (rows: typeof duelAll) => {
    const count = (outcome: "WIN" | "LOSS" | "DRAW") => rows.find((row) => row.outcome === outcome)?._count ?? 0;
    return `${count("WIN")}/${count("LOSS")}/${count("DRAW")}`;
  };

  const powerSparkData = powerHistory
    .map((snapshot) =>
      snapshot.entries
        .map((e) => latestPowerFromEntryData(e.data))
        .filter((v): v is number => v !== null)
        .reduce((a, b) => a + b, 0),
    )
    .reverse();

  const duelDots = [...recentDuels].reverse();

  const lastRaidWater = recentRaids[0]?.participants.reduce((sum, p) => sum + (p.waterCollected ?? 0), 0) ?? null;
  const prevRaidWater = recentRaids[1]?.participants.reduce((sum, p) => sum + (p.waterCollected ?? 0), 0) ?? null;
  const raidWaterDelta = lastRaidWater !== null && prevRaidWater !== null ? lastRaidWater - prevRaidWater : null;

  let memberRows: StatsMemberRow[] = [];
  let health = null;
  if (isR4Plus) {
    const members = await prisma.allianceMember.findMany({
      where: { memberStatus: { notIn: ["LEFT", "TRANSFERRED"] } },
      orderBy: { username: "asc" },
      include: {
        duelScores: { orderBy: { day: { date: "desc" } }, take: 1, include: { day: { select: { date: true } } } },
        raidParticipants: {
          where: { registrationStatus: { in: ["SELECTED_PARTICIPANT", "SELECTED_RESERVIST"] } },
          orderBy: { plan: { raidDate: "desc" } },
          take: 1,
          include: { plan: { select: { raidDate: true } } },
        },
      },
    });
    const scores = await getContributionScores(members.map((member) => member.id));
    health = await getUploadHealth();
    memberRows = members.map((member) => ({
      id: member.id,
      username: member.username,
      rank: member.currentRank,
      status: member.memberStatus,
      power: member.currentPower?.toString() ?? null,
      contributionScore: scores.get(member.id)?.score ?? 50,
      lastDuelActivity: member.duelScores[0]?.day.date.toISOString() ?? null,
      lastRaidParticipation: member.raidParticipants[0]?.plan.raidDate.toISOString() ?? null,
    }));
  }

  // Personal stats for R1-R3 members
  let myPower: number | null = null;
  let myContribution: ContributionScore | null = null;
  if (!isR4Plus && allianceMemberId) {
    const [ownMember, scores] = await Promise.all([
      prisma.allianceMember.findUnique({
        where: { id: allianceMemberId },
        select: { currentPower: true },
      }),
      getContributionScores([allianceMemberId]),
    ]);
    myPower = ownMember?.currentPower != null ? Number(ownMember.currentPower) : null;
    myContribution = scores.get(allianceMemberId) ?? null;
  }

  const powerDeltaPct = myPower !== null && averagePower > 0
    ? ((myPower - averagePower) / averagePower) * 100
    : null;

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {!latestRoster && (
        <section className="rounded-md border border-border-subtle bg-surface p-4 text-sm text-text-muted">
          {t("noData")}
        </section>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("totalPower")}
          value={latestRoster ? formatPower(totalPower) : t("noDataShort")}
          sparkData={powerSparkData.length > 1 ? powerSparkData : undefined}
        />
        <StatCard label={t("averagePower")} value={latestRoster ? formatPower(averagePower) : t("noDataShort")} />
        <StatCard label={t("weeklyGrowth")} value={growth === null ? t("noDataShort") : `${growth.toFixed(1)}%`} />
        <StatCard label={t("activeMembers")} value={activeMembers} delta={t("tempAwayCount", { count: tempAwayCount })} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <StatCard label={t("duelRecordAll")} value={recordLabel(duelAll)} delta={t("recordFormat")} />
        <StatCard label={t("duelRecord30")} value={recordLabel(duel30)} delta={t("recordFormat")} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card size="sm">
          <CardContent className="space-y-2">
            <span className="text-[11px] font-normal tracking-[0.07em] uppercase text-muted">{t("duelMomentum")}</span>
            <div className="flex items-center gap-2 pt-0.5">
              {duelDots.length === 0 ? (
                <span className="text-sm text-muted">{t("noDuelHistory")}</span>
              ) : (
                duelDots.map((duel, i) => (
                  <div
                    key={`${duel.id}-${i}`}
                    title={duel.outcome ?? "DRAW"}
                    className={cn(
                      "h-4 w-4 rounded-full",
                      duel.outcome === "WIN" ? "bg-success" : duel.outcome === "LOSS" ? "bg-danger" : "bg-muted opacity-40",
                    )}
                  />
                ))
              )}
            </div>
            {duelDots.length > 0 && (
              <span className="text-[11px] text-muted">{t("duelMomentumHint")}</span>
            )}
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="space-y-2">
            <span className="text-[11px] font-normal tracking-[0.07em] uppercase text-muted">{t("raidYieldTitle")}</span>
            <div className="flex items-baseline gap-2 pt-0.5">
              <span className="text-2xl font-medium text-gold leading-none tabular-nums">
                {lastRaidWater !== null ? lastRaidWater.toLocaleString() : t("noDataShort")}
              </span>
              {raidWaterDelta !== null && (
                <span className={cn("text-[11px] font-semibold", raidWaterDelta >= 0 ? "text-success" : "text-danger")}>
                  {raidWaterDelta >= 0 ? "+" : ""}{raidWaterDelta.toLocaleString()}
                </span>
              )}
            </div>
            {lastRaidWater !== null && (
              <span className="text-[11px] text-muted">{t("raidYieldVsPrevious")}</span>
            )}
          </CardContent>
        </Card>
      </div>

      {!isR4Plus && (myPower !== null || myContribution) && (
        <Card>
          <CardHeader className="border-b pb-3">
            <CardTitle>{t("yourStats")}</CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {myPower !== null && (
                <StatCard
                  label={t("yourPower")}
                  value={formatPower(myPower)}
                  delta={
                    powerDeltaPct !== null
                      ? powerDeltaPct >= 0
                        ? t("powerAboveAverage", { delta: powerDeltaPct.toFixed(1) })
                        : t("powerBelowAverage", { delta: Math.abs(powerDeltaPct).toFixed(1) })
                      : undefined
                  }
                />
              )}
              {myContribution && (
                <>
                  <StatCard label={t("contributionScore")} value={String(myContribution.score)} />
                  {myContribution.duelTotal > 0 && (
                    <StatCard
                      label={t("duelParticipation")}
                      value={`${myContribution.duelParticipated}/${myContribution.duelTotal}`}
                    />
                  )}
                  {myContribution.raidTotal > 0 && (
                    <StatCard
                      label={t("raidParticipation")}
                      value={`${myContribution.raidParticipated}/${myContribution.raidTotal}`}
                    />
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {isR4Plus && health && (
        <>
          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle>{t("uploadHealth")}</CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              <UploadHealthChips health={health} />
            </CardContent>
          </Card>
          <StatsMemberTable members={memberRows} />
        </>
      )}
    </div>
  );
}
