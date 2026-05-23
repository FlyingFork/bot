import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { prisma } from "@tiles-survive/database";
import { auth } from "@/lib/auth";
import {
  EventTrendChart,
  MemberDistributionChart,
  RankCompositionChart,
  RosterPowerTrendChart,
} from "@/components/alliance/DashboardCharts";
import { ChartCard } from "@/components/ui/chart-card";
import { DataCard } from "@/components/ui/data-card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  buildEventTrend,
  buildPowerBrackets,
  buildRankCompositionTrend,
  buildRosterTrend,
  findMissingMembers,
  findRosterChanges,
  findRosterPowerGrowth,
  summarizeMembers,
} from "@/lib/alliance-dashboard";
import { formatImportedAt, formatPower } from "@/lib/alliance-format";

export const dynamic = "force-dynamic";

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-72 items-center justify-center rounded-md border border-dashed border-border-default bg-base px-4 text-center text-sm text-text-muted">
      {message}
    </div>
  );
}

function signedPower(value: bigint, locale: string, unknown: string) {
  if (value === BigInt(0)) {
    return formatPower(value, locale, unknown);
  }

  const absoluteValue = value > BigInt(0) ? value : -value;
  return `${value > BigInt(0) ? "+" : "-"}${formatPower(
    absoluteValue,
    locale,
    unknown,
  )}`;
}

function changeTypeBadge(type: "promoted" | "demoted" | "new", labels: Record<string, string>) {
  const styles = {
    promoted: "bg-cn-success/10 text-cn-success",
    demoted: "bg-cn-danger/10 text-cn-danger",
    new: "bg-cn-cyan/10 text-cn-cyan",
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${styles[type]}`}>
      {labels[type]}
    </span>
  );
}

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const commonT = await getTranslations("common");
  const locale = await getLocale();
  const session = await auth.api.getSession({ headers: await headers() });
  const username = session?.user?.username ?? session?.user?.name ?? "";
  const [
    settings,
    activeMembers,
    archivedMemberCount,
    rosterImports,
    siegeImports,
    explorationImports,
    lastRaidPlan,
    latestExplorationImport,
  ] = await Promise.all([
    prisma.allianceSettings.findUnique({ where: { id: "primary" } }),
    prisma.allianceMember.findMany({
      where: { active: true },
      orderBy: [{ currentPower: "desc" }, { username: "asc" }],
      select: {
        id: true,
        username: true,
        currentPower: true,
        currentPowerPlantLevel: true,
        currentRank: true,
      },
    }),
    prisma.allianceMember.count({ where: { active: false } }),
    prisma.allianceRosterImport.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        createdAt: true,
        snapshots: {
          select: {
            memberId: true,
            power: true,
            rank: true,
            member: {
              select: {
                id: true,
                username: true,
                active: true,
              },
            },
          },
        },
      },
    }),
    prisma.allianceEventImport.findMany({
      where: { eventType: "ALLIANCE_SIEGE" },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        createdAt: true,
        snapshots: { select: { power: true } },
      },
    }),
    prisma.allianceEventImport.findMany({
      where: { eventType: "EXPLORATION" },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        createdAt: true,
        snapshots: { select: { power: true } },
      },
    }),
    prisma.reservoirRaidPlan.findFirst({
      orderBy: { raidDate: "desc" },
      select: {
        id: true,
        _count: { select: { participants: true } },
      },
    }),
    prisma.allianceEventImport.findFirst({
      where: { eventType: "EXPLORATION" },
      orderBy: { createdAt: "desc" },
      select: {
        snapshots: {
          select: {
            explorationLevel: true,
            power: true,
            member: { select: { id: true, username: true } },
          },
          orderBy: { explorationLevel: "desc" },
          take: 5,
        },
      },
    }),
  ]);

  const currentSummary = summarizeMembers(activeMembers, {
    unknown: commonT("unknown"),
    powerPlantLevel: (level) => t("powerPlantLevel", { level }),
  });
  const rosterTrend = buildRosterTrend(rosterImports, locale);
  const siegeTrend = buildEventTrend(siegeImports, locale);
  const explorationTrend = buildEventTrend(explorationImports, locale);
  const rankCompositionTrend = buildRankCompositionTrend(rosterImports, locale);
  const powerBrackets = buildPowerBrackets(activeMembers, commonT("unknown"));
  const rosterChanges = findRosterChanges(rosterImports);
  const missingMembers = findMissingMembers(rosterImports, activeMembers);

  const strongestMembers = activeMembers
    .filter((member) => member.currentPower !== null)
    .slice(0, 5);
  const growthRows = findRosterPowerGrowth(rosterImports).slice(0, 5);
  const latestRosterImport = rosterImports[0];
  const rosterPowerSeries = rosterTrend.map((point) => point.totalPower);
  const dashboardTitle = settings?.name
    ? t("namedTitle", { name: settings.name })
    : t("title");
  const dashboardTag = settings?.tag ? `[${settings.tag}] ` : "";

  const raidParticipantCount = lastRaidPlan?._count.participants ?? null;
  const raidParticipationPct =
    raidParticipantCount !== null && activeMembers.length > 0
      ? Math.round((raidParticipantCount / activeMembers.length) * 100)
      : null;

  const lastSiegeMemberCount = siegeImports[0]?.snapshots.length ?? null;
  const siegeAttendancePct =
    lastSiegeMemberCount !== null && activeMembers.length > 0
      ? Math.round((lastSiegeMemberCount / activeMembers.length) * 100)
      : null;

  const topExplorers = (latestExplorationImport?.snapshots ?? []).filter(
    (s) => s.explorationLevel !== null,
  );

  const changeLabels = {
    promoted: t("rosterChanges.promoted"),
    demoted: t("rosterChanges.demoted"),
    new: t("rosterChanges.new"),
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-up">
      <PageHeader
        title={dashboardTitle}
        subtitle={t("overviewSubtitle", { username, tag: dashboardTag })}
      />

      {/* Stat cards — 6 total, 2 rows on large screens */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          delta={t("stats.archived", { count: archivedMemberCount })}
          label={t("stats.activeRoster")}
          value={activeMembers.length}
        />
        <StatCard
          delta={t("stats.membersWithRosterPower", {
            count: currentSummary.knownPowerCount,
          })}
          label={t("stats.currentAlliancePower")}
          sparkData={rosterPowerSeries}
          value={formatPower(currentSummary.totalPower, locale, commonT("unknown"))}
        />
        <StatCard
          delta={t("stats.knownRosterPowerOnly")}
          label={t("stats.averageMemberPower")}
          value={formatPower(currentSummary.averagePower, locale, commonT("unknown"))}
        />
        <StatCard
          delta={t("stats.latestImport", {
            date: formatImportedAt(
              latestRosterImport?.createdAt,
              locale,
              commonT("noData"),
            ),
          })}
          label={t("stats.rosterCoverage")}
          value={`${currentSummary.knownPowerCount}/${activeMembers.length}`}
        />
        <StatCard
          delta={
            raidParticipantCount !== null
              ? t("stats.ofActiveMembers", {
                  count: raidParticipantCount,
                  total: activeMembers.length,
                })
              : t("stats.noRaidData")
          }
          label={t("stats.raidParticipationRate")}
          value={
            raidParticipationPct !== null
              ? `${raidParticipationPct}%`
              : commonT("noData")
          }
        />
        <StatCard
          delta={
            lastSiegeMemberCount !== null
              ? t("stats.ofActiveMembers", {
                  count: lastSiegeMemberCount,
                  total: activeMembers.length,
                })
              : t("stats.noSiegeData")
          }
          label={t("stats.siegeAttendanceRate")}
          value={
            siegeAttendancePct !== null
              ? `${siegeAttendancePct}%`
              : commonT("noData")
          }
        />
      </div>

      {/* Alliance power trend + rank / plant distribution */}
      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.35fr)_minmax(21rem,1fr)]">
        <ChartCard
          description={t("charts.alliancePowerTrendDescription")}
          title={t("charts.alliancePowerTrend")}
        >
          {rosterTrend.length ? (
            <RosterPowerTrendChart data={rosterTrend} />
          ) : (
            <EmptyChart message={t("charts.alliancePowerEmpty")} />
          )}
        </ChartCard>
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-1">
          <ChartCard
            description={t("charts.rankMixDescription")}
            title={t("charts.rankMix")}
          >
            {activeMembers.length ? (
              <MemberDistributionChart
                color="#00D2FF"
                data={currentSummary.rankDistribution}
              />
            ) : (
              <EmptyChart message={t("charts.rankMixEmpty")} />
            )}
          </ChartCard>
          <ChartCard
            description={t("charts.powerPlantLevelsDescription")}
            title={t("charts.powerPlantLevels")}
          >
            {activeMembers.length ? (
              <MemberDistributionChart
                color="#00E676"
                data={currentSummary.powerPlantDistribution}
              />
            ) : (
              <EmptyChart message={t("charts.powerPlantLevelsEmpty")} />
            )}
          </ChartCard>
        </div>
      </div>

      {/* Rank composition over time + power bracket distribution */}
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          description={t("charts.rankCompositionDescription")}
          title={t("charts.rankComposition")}
        >
          {rankCompositionTrend.length ? (
            <RankCompositionChart data={rankCompositionTrend} />
          ) : (
            <EmptyChart message={t("charts.rankCompositionEmpty")} />
          )}
        </ChartCard>
        <ChartCard
          description={t("charts.powerBracketsDescription")}
          title={t("charts.powerBrackets")}
        >
          {powerBrackets.length ? (
            <MemberDistributionChart color="#A78BFA" data={powerBrackets} />
          ) : (
            <EmptyChart message={t("charts.powerBracketsEmpty")} />
          )}
        </ChartCard>
      </div>

      {/* Siege + exploration event trends */}
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          description={t("charts.siegeSnapshotsDescription")}
          title={t("charts.siegeSnapshots")}
        >
          {siegeTrend.length ? (
            <EventTrendChart color="#FF3B5C" data={siegeTrend} />
          ) : (
            <EmptyChart message={t("charts.siegeSnapshotsEmpty")} />
          )}
        </ChartCard>
        <ChartCard
          description={t("charts.explorationSnapshotsDescription")}
          title={t("charts.explorationSnapshots")}
        >
          {explorationTrend.length ? (
            <EventTrendChart color="#FF9D00" data={explorationTrend} />
          ) : (
            <EmptyChart message={t("charts.explorationSnapshotsEmpty")} />
          )}
        </ChartCard>
      </div>

      {/* Power leaders + growth */}
      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <DataCard
          className="min-w-0"
          description={t("leaders.description")}
          title={t("leaders.title")}
        >
          {strongestMembers.length ? (
            <>
              <div className="space-y-2 sm:hidden">
                {strongestMembers.map((member) => (
                  <div
                    key={member.id}
                    className="rounded-md border border-border-dim bg-base px-3 py-2.5 text-xs"
                  >
                    <div className="mb-2 min-w-0">
                      <Link
                        href={`/dashboard/members/${member.id}`}
                        className="block truncate font-semibold text-text-primary hover:text-cn-cyan"
                      >
                        {member.username}
                      </Link>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                      <span className="text-text-muted">{t("table.rank")}</span>
                      <span className="min-w-0 text-right text-text-secondary">
                        {member.currentRank ?? commonT("unknown")}
                      </span>
                      <span className="text-text-muted">{t("table.power")}</span>
                      <span className="min-w-0 break-all text-right font-mono text-text-primary">
                        {formatPower(member.currentPower, locale, commonT("unknown"))}
                      </span>
                      <span className="text-text-muted">{t("table.plant")}</span>
                      <span className="min-w-0 text-right text-text-secondary">
                        {member.currentPowerPlantLevel ?? commonT("unknown")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("table.member")}</TableHead>
                      <TableHead>{t("table.rank")}</TableHead>
                      <TableHead className="text-right">{t("table.power")}</TableHead>
                      <TableHead className="text-right">{t("table.plant")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {strongestMembers.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-semibold text-text-primary">
                          <Link
                            href={`/dashboard/members/${member.id}`}
                            className="hover:text-cn-cyan"
                          >
                            {member.username}
                          </Link>
                        </TableCell>
                        <TableCell>{member.currentRank ?? commonT("unknown")}</TableCell>
                        <TableCell className="text-right font-mono text-text-primary">
                          {formatPower(member.currentPower, locale, commonT("unknown"))}
                        </TableCell>
                        <TableCell className="text-right">
                          {member.currentPowerPlantLevel ?? commonT("unknown")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <p className="text-sm text-text-muted">{t("leaders.empty")}</p>
          )}
        </DataCard>
        <DataCard
          className="min-w-0"
          description={t("growth.description")}
          title={t("growth.title")}
        >
          {growthRows.length ? (
            <>
              <div className="space-y-2 sm:hidden">
                {growthRows.map((row) => (
                  <div
                    key={row.id}
                    className="rounded-md border border-border-dim bg-base px-3 py-2.5 text-xs"
                  >
                    <div className="mb-2 min-w-0">
                      <Link
                        href={`/dashboard/members/${row.id}`}
                        className="block truncate font-semibold text-text-primary hover:text-cn-cyan"
                      >
                        {row.username}
                      </Link>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                      <span className="text-text-muted">{t("table.previous")}</span>
                      <span className="min-w-0 break-all text-right font-mono text-text-secondary">
                        {formatPower(row.previousPower, locale, commonT("unknown"))}
                      </span>
                      <span className="text-text-muted">{t("table.latest")}</span>
                      <span className="min-w-0 break-all text-right font-mono text-text-primary">
                        {formatPower(row.currentPower, locale, commonT("unknown"))}
                      </span>
                      <span className="text-text-muted">{t("table.change")}</span>
                      <span
                        className={`min-w-0 break-all text-right font-mono ${
                          row.delta > BigInt(0)
                            ? "text-cn-success"
                            : row.delta < BigInt(0)
                              ? "text-cn-danger"
                              : "text-text-muted"
                        }`}
                      >
                        {signedPower(row.delta, locale, commonT("unknown"))}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("table.member")}</TableHead>
                      <TableHead className="text-right">{t("table.previous")}</TableHead>
                      <TableHead className="text-right">{t("table.latest")}</TableHead>
                      <TableHead className="text-right">{t("table.change")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {growthRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-semibold text-text-primary">
                          <Link
                            href={`/dashboard/members/${row.id}`}
                            className="hover:text-cn-cyan"
                          >
                            {row.username}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatPower(row.previousPower, locale, commonT("unknown"))}
                        </TableCell>
                        <TableCell className="text-right font-mono text-text-primary">
                          {formatPower(row.currentPower, locale, commonT("unknown"))}
                        </TableCell>
                        <TableCell
                          className={`text-right font-mono ${
                            row.delta > BigInt(0)
                              ? "text-cn-success"
                              : row.delta < BigInt(0)
                                ? "text-cn-danger"
                                : "text-text-muted"
                          }`}
                        >
                          {signedPower(row.delta, locale, commonT("unknown"))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <p className="text-sm text-text-muted">{t("growth.empty")}</p>
          )}
        </DataCard>
      </div>

      {/* Top explorers + roster changes */}
      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <DataCard
          className="min-w-0"
          description={t("topExplorers.description")}
          title={t("topExplorers.title")}
        >
          {topExplorers.length ? (
            <>
              <div className="space-y-2 sm:hidden">
                {topExplorers.map((entry) => (
                  <div
                    key={entry.member.id}
                    className="rounded-md border border-border-dim bg-base px-3 py-2.5 text-xs"
                  >
                    <div className="mb-2 min-w-0">
                      <Link
                        href={`/dashboard/members/${entry.member.id}`}
                        className="block truncate font-semibold text-text-primary hover:text-cn-cyan"
                      >
                        {entry.member.username}
                      </Link>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                      <span className="text-text-muted">
                        {t("table.explorationLevel")}
                      </span>
                      <span className="min-w-0 text-right font-mono text-text-primary">
                        {entry.explorationLevel}
                      </span>
                      <span className="text-text-muted">{t("table.power")}</span>
                      <span className="min-w-0 break-all text-right font-mono text-text-secondary">
                        {formatPower(entry.power, locale, commonT("unknown"))}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("table.member")}</TableHead>
                      <TableHead className="text-right">
                        {t("table.explorationLevel")}
                      </TableHead>
                      <TableHead className="text-right">{t("table.power")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topExplorers.map((entry) => (
                      <TableRow key={entry.member.id}>
                        <TableCell className="font-semibold text-text-primary">
                          <Link
                            href={`/dashboard/members/${entry.member.id}`}
                            className="hover:text-cn-cyan"
                          >
                            {entry.member.username}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right font-mono text-text-primary">
                          {entry.explorationLevel}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatPower(entry.power, locale, commonT("unknown"))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <p className="text-sm text-text-muted">{t("topExplorers.empty")}</p>
          )}
        </DataCard>
        <DataCard
          className="min-w-0"
          description={t("rosterChanges.description")}
          title={t("rosterChanges.title")}
        >
          {rosterChanges.length ? (
            <>
              {/* Mobile */}
              <div className="space-y-2 sm:hidden">
                {rosterChanges.map((row) => (
                  <div
                    key={row.id}
                    className="rounded-md border border-border-dim bg-base px-3 py-2.5 text-xs"
                  >
                    <div className="mb-2 flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/dashboard/members/${row.id}`}
                          className="block truncate font-semibold text-text-primary hover:text-cn-cyan"
                        >
                          {row.username}
                        </Link>
                      </div>
                      <div className="shrink-0">
                        {changeTypeBadge(row.type, changeLabels)}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                      <span className="text-text-muted">{t("table.change")}</span>
                      <span className="min-w-0 text-right text-text-secondary">
                        {row.prevRank ? `${row.prevRank} → ${row.currRank}` : row.currRank}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("table.member")}</TableHead>
                      <TableHead>{t("table.type")}</TableHead>
                      <TableHead>{t("table.change")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rosterChanges.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-semibold text-text-primary">
                          <Link
                            href={`/dashboard/members/${row.id}`}
                            className="hover:text-cn-cyan"
                          >
                            {row.username}
                          </Link>
                        </TableCell>
                        <TableCell>{changeTypeBadge(row.type, changeLabels)}</TableCell>
                        <TableCell className="text-text-muted">
                          {row.prevRank
                            ? `${row.prevRank} → ${row.currRank}`
                            : row.currRank}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <p className="text-sm text-text-muted">{t("rosterChanges.empty")}</p>
          )}
        </DataCard>
      </div>

      {/* Missing members — only shown when there are some */}
      {missingMembers.length > 0 && (
        <DataCard
          description={t("missingMembers.description")}
          title={t("missingMembers.title")}
        >
          <>
            {/* Mobile */}
            <div className="space-y-1.5 sm:hidden">
              {missingMembers.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded border border-border-dim px-3 py-2 text-xs"
                >
                  <Link
                    href={`/dashboard/members/${m.id}`}
                    className="font-semibold text-text-primary hover:text-cn-cyan"
                  >
                    {m.username}
                  </Link>
                  <span className="text-text-muted">
                    {m.lastSeen
                      ? t("missingMembers.lastSeen", {
                          date: formatImportedAt(m.lastSeen, locale, commonT("noData")),
                        })
                      : commonT("noData")}
                  </span>
                </div>
              ))}
            </div>
            {/* Desktop */}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("table.member")}</TableHead>
                    <TableHead>{t("table.lastSeen")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {missingMembers.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-semibold text-text-primary">
                        <Link
                          href={`/dashboard/members/${m.id}`}
                          className="hover:text-cn-cyan"
                        >
                          {m.username}
                        </Link>
                      </TableCell>
                      <TableCell className="text-text-muted">
                        {m.lastSeen
                          ? formatImportedAt(m.lastSeen, locale, commonT("noData"))
                          : commonT("noData")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        </DataCard>
      )}
    </div>
  );
}
