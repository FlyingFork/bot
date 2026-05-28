import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@tiles-survive/database";
import { getCurrentUser } from "@/lib/server-auth";
import { hasRole } from "@/lib/roles";
import { jsonSafe } from "@/lib/json";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { MemberProfileActions } from "@/components/phase2/MemberProfileActions";
import type { MemberSummary } from "@/components/phase2/types";
import { EmptyState, formatDate, roleLabel, statusBadge } from "@/components/phase2/Phase2Utils";
import { getContributionScores, latestPowerFromEntryData } from "@/lib/phase4";
import { LEADERBOARD_VALUE_FIELDS, isPhase4LeaderboardType, numberFromEntryData } from "@/lib/phase4-shared";
import {
  MemberProfilePhase4,
  type DuelHistoryRow,
  type PowerPoint,
  type ProfileMember,
  type RaidHistoryRow,
  type RankPoint,
} from "@/components/phase4/MemberProfilePhase4";
import { MemberComparePicker, type CompareMemberOption } from "@/components/phase4/MemberComparePicker";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ compare?: string }>;
};

export default async function MemberProfilePage({ params, searchParams }: Props) {
  const t = await getTranslations("phase2.members");
  const profileT = await getTranslations("phase2.profile");
  const common = await getTranslations("phase2.common");
  const statusT = await getTranslations("phase2.status");
  const rolesT = await getTranslations("phase2.roles");
  const user = await getCurrentUser();
  const { id } = await params;
  const { compare } = await searchParams;
  const canViewFull = hasRole(user?.role, "r4");
  const isOwnProfile = user?.allianceMemberId === id;

  if (!canViewFull && user?.allianceMemberId !== id) notFound();

  const member = await prisma.allianceMember.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          name: true,
          role: true,
          platformStatus: true,
          banned: true,
        },
      },
      nameHistory: { orderBy: { changedAt: "desc" } },
    },
  });

  if (!member) notFound();
  const compareMember = canViewFull && compare && compare !== id
    ? await prisma.allianceMember.findUnique({ where: { id: compare }, select: { id: true, username: true } })
    : null;
  const profileMembers = [member, compareMember].filter(Boolean) as Array<{ id: string; username: string }>;
  const memberIds = profileMembers.map((item) => item.id);
  const [contributionScores, leaderboardEntries, duelInstances, raidParticipants, compareOptions] = await Promise.all([
    getContributionScores(memberIds),
    prisma.leaderboardEntry.findMany({
      where: { memberId: { in: memberIds } },
      include: { snapshot: { select: { type: true, capturedAt: true } } },
      orderBy: { snapshot: { capturedAt: "asc" } },
    }),
    prisma.allianceDuelInstance.findMany({
      where: { status: "ENDED", days: { some: { scores: { some: { memberId: { in: memberIds } } } } } },
      orderBy: { startDate: "desc" },
      include: {
        days: {
          orderBy: { dayNumber: "asc" },
          include: { scores: { where: { memberId: { in: memberIds } }, select: { memberId: true, points: true } } },
        },
      },
    }),
    prisma.reservoirRaidParticipant.findMany({
      where: { memberId: { in: memberIds } },
      orderBy: { plan: { raidDate: "desc" } },
      include: { plan: { select: { raidDate: true } } },
    }),
    canViewFull
      ? prisma.allianceMember.findMany({
          where: { id: { not: id }, memberStatus: { notIn: ["LEFT", "TRANSFERRED"] } },
          orderBy: { username: "asc" },
          select: { id: true, username: true, currentPower: true },
        })
      : Promise.resolve([]),
  ]);

  const powerPoints: PowerPoint[] = leaderboardEntries
    .filter((entry) => entry.memberId && (entry.snapshot.type === "SOLO_POWER" || entry.snapshot.type === "ALLIANCE_PLAYER_LIST"))
    .map((entry) => ({
      date: entry.snapshot.capturedAt.toISOString(),
      memberId: entry.memberId!,
      value: latestPowerFromEntryData(entry.data) ?? 0,
    }))
    .filter((point) => point.value > 0);

  const rankPoints: RankPoint[] = leaderboardEntries
    .filter((entry) => entry.memberId && entry.rank !== null)
    .map((entry) => {
      const type = entry.snapshot.type;
      const figure = isPhase4LeaderboardType(type)
        ? (numberFromEntryData(entry.data, LEADERBOARD_VALUE_FIELDS[type]) ?? undefined)
        : undefined;
      return {
        date: entry.snapshot.capturedAt.toISOString(),
        memberId: entry.memberId!,
        rank: entry.rank!,
        type,
        figure,
      };
    }) as RankPoint[];

  const duelRows: DuelHistoryRow[] = duelInstances.flatMap((instance) =>
    memberIds.map((memberId) => {
      const days = [1, 2, 3, 4, 5, 6].map((dayNumber) => {
        const day = instance.days.find((item) => item.dayNumber === dayNumber);
        const points = day?.scores.find((score) => score.memberId === memberId)?.points;
        return points !== undefined ? Number(points) : null;
      });
      return {
        instanceId: instance.id,
        memberId,
        week: instance.startDate.toISOString(),
        opponent: instance.opponentName ?? instance.opponentTag ?? "",
        days,
        total: days.reduce<number>((sum, points) => sum + (points ?? 0), 0),
        outcome: instance.outcome,
      };
    }),
  );

  const raidRows: RaidHistoryRow[] = raidParticipants.map((participant) => ({
    id: participant.id,
    memberId: participant.memberId!,
    date: participant.plan.raidDate.toISOString(),
    status: participant.registrationStatus,
    waterCollected: participant.waterCollected,
  }));

  const serializedMember = jsonSafe(member) as MemberSummary & {
    nameHistory: Array<{ id: string; name: string; changedAt: string }>;
  };
  const canEdit = user?.role === "admin";
  const phase4Members: ProfileMember[] = profileMembers.map((item) => {
    const contribution = contributionScores.get(item.id);
    return {
      id: item.id,
      username: item.username,
      contribution: contribution ?? {
        score: 50,
        powerGrowthScore: 50,
        duelScore: 50,
        raidScore: 50,
        duelParticipated: 0,
        duelTotal: 0,
        raidParticipated: 0,
        raidTotal: 0,
        weights: { power: 30, duel: 35, raid: 35 },
      },
    };
  });
  const comparePickerOptions = jsonSafe(compareOptions) as CompareMemberOption[];

  return (
    <div className="space-y-6">
      <PageHeader
        title={member.username}
        subtitle={t("profileSubtitle")}
        action={<MemberProfileActions member={serializedMember} canTempAway={canViewFull} canEdit={canEdit} />}
      />

      <section className="rounded-md border border-border-subtle bg-surface p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{member.currentRank ?? common("none")}</Badge>
          {statusBadge(member.memberStatus, undefined, statusT(member.memberStatus))}
          {member.isTempAway && (
            <Badge variant="warning">{t("tempAway")}: {member.tempAwayAllianceTag ?? t("tagMissing")}</Badge>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{t("ingameName")}</p>
            <p className="text-sm text-text-primary">{member.username}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{t("rank")}</p>
            <p className="text-sm text-text-primary">{member.currentRank ?? common("none")}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{t("status")}</p>
            <p className="text-sm text-text-primary">{statusT(member.memberStatus)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{t("joined")}</p>
            <p className="text-sm text-text-primary">{formatDate(member.joinedAt)}</p>
          </div>
        </div>
      </section>

      {(canViewFull || isOwnProfile) && serializedMember.nameHistory.length > 0 && (
        <section className="rounded-md border border-border-subtle bg-surface p-4 space-y-3">
          <h2 className="text-sm font-bold text-text-primary">{t("nameHistory")}</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("pastName")}</TableHead>
                <TableHead>{t("changed")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {serializedMember.nameHistory.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{formatDate(item.changedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}

      {canViewFull && (
        <section className="rounded-md border border-border-subtle bg-surface p-4 space-y-3">
          <h2 className="text-sm font-bold text-text-primary">{t("linkedAccountSection")}</h2>
          {member.user ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{profileT("username")}</p>
                <p className="text-sm text-text-primary">{member.user.username ?? member.user.name}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{profileT("role")}</p>
                <p className="text-sm text-text-primary">{roleLabel(member.user.role, common("none"), rolesT("admin"))}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{t("accountStatus")}</p>
                <p className="text-sm text-text-primary">{member.user.platformStatus}</p>
              </div>
            </div>
          ) : (
            <EmptyState>{t("noLinkedAccount")}</EmptyState>
          )}
        </section>
      )}

      {canViewFull && (
        <MemberComparePicker
          currentMemberId={id}
          currentPower={member.currentPower?.toString() ?? null}
          selectedCompareId={compare}
          options={comparePickerOptions}
        />
      )}

      <MemberProfilePhase4
        members={phase4Members}
        powerPoints={jsonSafe(powerPoints)}
        rankPoints={jsonSafe(rankPoints)}
        duelRows={jsonSafe(duelRows)}
        raidRows={jsonSafe(raidRows)}
      />
    </div>
  );
}
