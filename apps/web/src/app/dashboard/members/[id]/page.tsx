import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@tiles-survive/database";
import { DataCard } from "@/components/ui/data-card";
import { PageHeader } from "@/components/ui/page-header";
import { RoleBadge } from "@/components/ui/role-badge";
import { Sparkline } from "@/components/ui/sparkline";
import { StatCard } from "@/components/ui/stat-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { formatImportedAt, formatPower } from "@/lib/alliance-format";

export const dynamic = "force-dynamic";

function metricTrend(values: bigint[]) {
  return values
    .slice()
    .reverse()
    .map((value) => Number(value));
}

function statusVariant(active: boolean) {
  return active ? "online" : "offline";
}

function AttendanceRow({ label, attended, total }: { label: string; attended: number; total: number }) {
  const pct = total > 0 ? Math.round((attended / total) * 100) : 0;
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-text-muted">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-text-primary">
          {attended}/{total}
        </span>
        <span className="w-10 text-right text-[10px] font-bold text-text-muted">{pct}%</span>
      </div>
    </div>
  );
}

export default async function AllianceMemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("alliance.members.detail");
  const eventT = await getTranslations("alliance.events");
  const tableT = await getTranslations("alliance.table");
  const commonT = await getTranslations("common");
  const locale = await getLocale();
  const { id } = await params;
  const member = await prisma.allianceMember.findUnique({
    where: { id },
    include: {
      rosterSnapshots: {
        orderBy: { importedAt: "desc" },
        take: 12,
      },
      eventSnapshots: {
        orderBy: { importedAt: "desc" },
        take: 60,
      },
      raidSquadPowers: {
        orderBy: { createdAt: "desc" },
        take: 18,
        include: {
          participant: {
            select: {
              plan: {
                select: {
                  raidDate: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!member) {
    notFound();
  }

  const [
    powerRank,
    rankCategoryRank,
    totalActiveMembers,
    totalRosterImports,
    totalSiegeImports,
    totalExplorationImports,
    totalRaidPlans,
    memberRaidParticipation,
  ] = await Promise.all([
    member.currentPower
      ? prisma.allianceMember.count({
          where: {
            active: true,
            currentPower: { gt: member.currentPower },
          },
        })
      : null,
    member.currentPower && member.currentRank
      ? prisma.allianceMember.count({
          where: {
            active: true,
            currentRank: member.currentRank,
            currentPower: { gt: member.currentPower },
          },
        })
      : null,
    prisma.allianceMember.count({ where: { active: true } }),
    prisma.allianceRosterImport.count(),
    prisma.allianceEventImport.count({ where: { eventType: "ALLIANCE_SIEGE" } }),
    prisma.allianceEventImport.count({ where: { eventType: "EXPLORATION" } }),
    prisma.reservoirRaidPlan.count(),
    prisma.reservoirRaidParticipant.count({ where: { memberId: member.id } }),
  ]);

  const siegeSnapshots = member.eventSnapshots.filter(
    (snapshot) => snapshot.eventType === "ALLIANCE_SIEGE",
  );
  const explorationSnapshots = member.eventSnapshots.filter(
    (snapshot) => snapshot.eventType === "EXPLORATION",
  );
  const latestSiege = siegeSnapshots[0];
  const latestExploration = explorationSnapshots[0];

  // Power percentile
  const powerPercentile =
    powerRank !== null && totalActiveMembers > 0
      ? Math.max(1, Math.round((powerRank / totalActiveMembers) * 100))
      : null;

  // Activity score (0–100)
  const rosterSeen = Math.min(member.rosterSnapshots.length, Math.min(totalRosterImports, 12));
  const rosterTotal = Math.min(totalRosterImports, 12);
  const siegeSeen = Math.min(siegeSnapshots.length, Math.min(totalSiegeImports, 60));
  const siegeTotal = Math.min(totalSiegeImports, 60);
  const explorationSeen = Math.min(explorationSnapshots.length, Math.min(totalExplorationImports, 60));
  const explorationTotal = Math.min(totalExplorationImports, 60);
  const rosterWeight = rosterTotal > 0 ? (rosterSeen / rosterTotal) * 30 : 0;
  const siegeWeight = siegeTotal > 0 ? (siegeSeen / siegeTotal) * 25 : 0;
  const explorationWeight = explorationTotal > 0 ? (explorationSeen / explorationTotal) * 25 : 0;
  const raidWeight = totalRaidPlans > 0 ? (memberRaidParticipation / totalRaidPlans) * 20 : 0;
  const activityScore = Math.round(rosterWeight + siegeWeight + explorationWeight + raidWeight);

  // Exploration level data for trend sparkline
  const explorationLevelData = explorationSnapshots
    .filter((s) => s.explorationLevel !== null)
    .slice()
    .reverse()
    .map((s) => s.explorationLevel as number);

  // Squad power stats
  const squadPowers = member.raidSquadPowers.map((s) => s.power);
  const bestSquadPower = squadPowers.length
    ? squadPowers.reduce((a, b) => (a > b ? a : b))
    : null;
  const avgSquadPower = squadPowers.length
    ? squadPowers.reduce((a, b) => a + b, BigInt(0)) / BigInt(squadPowers.length)
    : null;

  // Rank change history from roster snapshots (detect consecutive rank changes)
  const rankChanges: { from: string; to: string; date: Date }[] = [];
  for (let i = 0; i < member.rosterSnapshots.length - 1; i++) {
    const curr = member.rosterSnapshots[i];
    const prev = member.rosterSnapshots[i + 1];
    if (curr.rank !== prev.rank) {
      rankChanges.push({ from: prev.rank, to: curr.rank, date: curr.importedAt });
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-up">
      <PageHeader
        title={member.username}
        subtitle={t("subtitle")}
        action={
          <Link
            href={member.active ? "/dashboard/members" : "/dashboard/members/archive"}
            className={buttonVariants({ variant: "outline" })}
          >
            {t("back")}
          </Link>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <RoleBadge
          variant={statusVariant(member.active)}
          label={member.active ? t("active") : t("archived")}
        />
        <RoleBadge
          variant={
            member.currentRank === "R5"
              ? "r5"
              : member.currentRank === "R4"
                ? "r4"
                : "r3"
          }
          label={member.currentRank ?? t("unknownRank")}
        />
      </div>

      {/* Primary stat cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("currentPower")}
          value={formatPower(member.currentPower, locale, commonT("unknown"))}
        />
        <StatCard
          label={t("powerPlant")}
          value={member.currentPowerPlantLevel ?? commonT("unknown")}
        />
        <StatCard
          label={t("powerRank")}
          value={powerRank === null ? commonT("unknown") : `#${powerRank + 1}`}
        />
        <StatCard
          label={t("rankCategory")}
          value={
            rankCategoryRank === null
              ? commonT("unknown")
              : `${member.currentRank} #${rankCategoryRank + 1}`
          }
        />
      </div>

      {/* Secondary stat cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label={t("powerPercentile")}
          value={
            powerPercentile !== null
              ? t("topPercent", { percent: powerPercentile })
              : commonT("unknown")
          }
        />
        <StatCard
          label={t("activityScore")}
          value={`${activityScore}/100`}
        />
        <StatCard
          label={t("memberSince")}
          value={new Intl.DateTimeFormat(locale, {
            year: "numeric",
            month: "short",
            day: "numeric",
          }).format(member.createdAt)}
        />
      </div>

      {/* Roster history + latest event values */}
      <div className="grid gap-4 xl:grid-cols-2">
        <DataCard
          className="min-w-0"
          title={t("rosterHistory")}
          description={t("lastRosterImport", {
            date: formatImportedAt(
              member.lastRosterImportedAt,
              locale,
              commonT("noData"),
            ),
          })}
        >
          {member.rosterSnapshots.length ? (
            <div className="space-y-4">
              <Sparkline
                data={metricTrend(member.rosterSnapshots.map((snapshot) => snapshot.power))}
                height={72}
              />
              {/* Mobile: stacked rows */}
              <div className="space-y-1.5 sm:hidden">
                {member.rosterSnapshots.slice(0, 6).map((snapshot) => (
                  <div
                    key={snapshot.id}
                    className="flex items-center justify-between rounded border border-border-dim px-3 py-2 text-xs"
                  >
                    <div>
                      <p className="text-text-secondary">
                        {formatImportedAt(snapshot.importedAt, locale, commonT("noData"))}
                      </p>
                      <p className="text-text-muted">
                        {snapshot.rank} · {tableT("powerPlant")} {snapshot.powerPlantLevel}
                      </p>
                    </div>
                    <p className="font-mono font-bold text-text-primary">
                      {formatPower(snapshot.power, locale, commonT("unknown"))}
                    </p>
                  </div>
                ))}
              </div>
              {/* Desktop: table */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{tableT("imported")}</TableHead>
                      <TableHead>{tableT("rank")}</TableHead>
                      <TableHead className="text-right">{tableT("power")}</TableHead>
                      <TableHead className="text-right">
                        {tableT("powerPlant")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {member.rosterSnapshots.slice(0, 6).map((snapshot) => (
                      <TableRow key={snapshot.id}>
                        <TableCell>
                          {formatImportedAt(
                            snapshot.importedAt,
                            locale,
                            commonT("noData"),
                          )}
                        </TableCell>
                        <TableCell>{snapshot.rank}</TableCell>
                        <TableCell className="text-right font-mono text-text-primary">
                          {formatPower(snapshot.power, locale, commonT("unknown"))}
                        </TableCell>
                        <TableCell className="text-right">
                          {snapshot.powerPlantLevel}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <p className="text-sm text-text-muted">
              {t("eventOnly")}
            </p>
          )}
        </DataCard>
        <DataCard
          className="min-w-0"
          title={t("latestEventValues")}
          description={t("latestEventValuesDescription")}
        >
          <div className="space-y-3">
            <div className="rounded-md border border-border-dim bg-base p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
                {eventT("allianceSiege")}
              </p>
              <p className="mt-1 text-xl font-bold text-text-primary">
                {formatPower(latestSiege?.power, locale, commonT("unknown"))}
              </p>
              <p className="text-[11px] text-text-muted">
                {formatImportedAt(
                  latestSiege?.importedAt,
                  locale,
                  commonT("noData"),
                )}
              </p>
            </div>
            <div className="rounded-md border border-border-dim bg-base p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
                {eventT("exploration")}
              </p>
              <p className="mt-1 text-xl font-bold text-text-primary">
                {formatPower(
                  latestExploration?.power,
                  locale,
                  commonT("unknown"),
                )}
              </p>
              <p className="text-[11px] text-text-muted">
                {t("explorationLevel", {
                  level: latestExploration?.explorationLevel ?? commonT("unknown"),
                })}{" "}
                -{" "}
                {formatImportedAt(
                  latestExploration?.importedAt,
                  locale,
                  commonT("noData"),
                )}
              </p>
            </div>
          </div>
        </DataCard>
      </div>

      {/* Attendance + rank changes */}
      <div className="grid gap-4 xl:grid-cols-2">
        <DataCard
          title={t("attendance")}
          description={t("attendanceDescription")}
        >
          <div className="divide-y divide-border-dim">
            <AttendanceRow
              label={t("rosterAttendance")}
              attended={rosterSeen}
              total={rosterTotal}
            />
            <AttendanceRow
              label={t("siegeAttendance")}
              attended={siegeSeen}
              total={siegeTotal}
            />
            <AttendanceRow
              label={t("explorationAttendance")}
              attended={explorationSeen}
              total={explorationTotal}
            />
            <AttendanceRow
              label={t("raidAttendance")}
              attended={memberRaidParticipation}
              total={totalRaidPlans}
            />
          </div>
        </DataCard>
        <DataCard
          title={t("rankChanges")}
          description={t("rankChangesDescription")}
        >
          {rankChanges.length ? (
            <>
              {/* Mobile */}
              <div className="space-y-1.5 sm:hidden">
                {rankChanges.map((change, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded border border-border-dim px-3 py-2 text-xs"
                  >
                    <span className="text-text-muted">
                      {formatImportedAt(change.date, locale, commonT("noData"))}
                    </span>
                    <span className="font-semibold text-text-primary">
                      {t("rankChangedFromTo", { from: change.from, to: change.to })}
                    </span>
                  </div>
                ))}
              </div>
              {/* Desktop */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{tableT("imported")}</TableHead>
                      <TableHead>{tableT("rank")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rankChanges.map((change, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          {formatImportedAt(change.date, locale, commonT("noData"))}
                        </TableCell>
                        <TableCell className="font-semibold text-text-primary">
                          {t("rankChangedFromTo", { from: change.from, to: change.to })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <p className="text-sm text-text-muted">{t("noRankChanges")}</p>
          )}
        </DataCard>
      </div>

      {/* Siege trend + exploration trends (power + level) */}
      <div className="grid gap-4 xl:grid-cols-2">
        <DataCard title={t("allianceSiegeTrend")}>
          {siegeSnapshots.length ? (
            <Sparkline
              data={metricTrend(siegeSnapshots.map((snapshot) => snapshot.power))}
              height={72}
            />
          ) : (
            <p className="text-sm text-text-muted">{t("noSiegeSnapshots")}</p>
          )}
        </DataCard>
        <DataCard title={t("explorationTrend")}>
          {explorationSnapshots.length ? (
            <div className="space-y-4">
              <Sparkline
                data={metricTrend(explorationSnapshots.map((snapshot) => snapshot.power))}
                height={56}
                color="#FF9D00"
              />
              {explorationLevelData.length > 0 && (
                <div>
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-text-muted">
                    {t("explorationLevelTrend")}
                  </p>
                  <Sparkline data={explorationLevelData} height={40} color="#A78BFA" />
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-text-muted">{t("noExplorationSnapshots")}</p>
          )}
        </DataCard>
      </div>

      {/* Squad power summary + raid squad history */}
      {member.raidSquadPowers.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <StatCard
            label={t("bestSquadPower")}
            value={formatPower(bestSquadPower, locale, commonT("unknown"))}
          />
          <StatCard
            label={t("avgSquadPower")}
            value={formatPower(avgSquadPower, locale, commonT("unknown"))}
          />
        </div>
      )}

      <DataCard
        title={t("raidSquadHistory")}
        description={t("raidSquadHistoryDescription")}
      >
        {member.raidSquadPowers.length ? (
          <>
            {/* Mobile: stacked rows */}
            <div className="space-y-1.5 sm:hidden">
              {member.raidSquadPowers.map((squad) => (
                <div
                  key={squad.id}
                  className="flex items-center justify-between rounded border border-border-dim px-3 py-2 text-xs"
                >
                  <div>
                    <p className="text-text-secondary">
                      {squad.participant.plan.raidDate.toISOString().slice(0, 10)}{" "}
                      · {t("squadNumber", { squad: squad.squadIndex })}
                    </p>
                    <p className="text-text-muted">
                      {formatImportedAt(squad.createdAt, locale, commonT("noData"))}
                    </p>
                  </div>
                  <p className="font-mono font-bold text-text-primary">
                    {formatPower(squad.power, locale, commonT("unknown"))}
                  </p>
                </div>
              ))}
            </div>
            {/* Desktop: table */}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("raidWeek")}</TableHead>
                    <TableHead>{t("squad")}</TableHead>
                    <TableHead className="text-right">{tableT("power")}</TableHead>
                    <TableHead>{tableT("imported")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {member.raidSquadPowers.map((squad) => (
                    <TableRow key={squad.id}>
                      <TableCell>
                        {squad.participant.plan.raidDate.toISOString().slice(0, 10)}
                      </TableCell>
                      <TableCell>{t("squadNumber", { squad: squad.squadIndex })}</TableCell>
                      <TableCell className="text-right font-mono text-text-primary">
                        {formatPower(squad.power, locale, commonT("unknown"))}
                      </TableCell>
                      <TableCell>
                        {formatImportedAt(squad.createdAt, locale, commonT("noData"))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          <p className="text-sm text-text-muted">
            {t("noRaidSquadHistory")}
          </p>
        )}
      </DataCard>
    </div>
  );
}
