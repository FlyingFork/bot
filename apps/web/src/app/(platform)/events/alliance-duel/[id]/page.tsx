import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@tiles-survive/database";
import { PageHeader } from "@/components/ui/page-header";
import { AllianceDuelDetail, type DuelDetailData } from "@/components/phase5/AllianceDuelDetail";
import { requireUser } from "@/lib/server-auth";
import { canUploadDuelDay, recalculateAllianceDuelInstance } from "@/lib/phase5";

type Props = { params: Promise<{ id: string }> };

export default async function AllianceDuelDetailPage({ params }: Props) {
  const user = await requireUser();
  const { id } = await params;
  const t = await getTranslations("phase5.allianceDuel");
  await recalculateAllianceDuelInstance(id);

  const [duel, pendingChanges, activeMembers] = await Promise.all([
    prisma.allianceDuelInstance.findUnique({
      where: { id },
      include: {
        days: {
          orderBy: { dayNumber: "asc" },
          include: {
            scores: {
              orderBy: { points: "desc" },
              include: { member: { select: { id: true, username: true } } },
            },
          },
        },
      },
    }),
    prisma.pendingChange.findMany({
      where: { type: "ALLIANCE_DUEL_DAY", status: "PENDING", eventInstanceId: id },
      select: { eventDay: true },
    }),
    prisma.allianceMember.findMany({
      where: { memberStatus: { notIn: ["LEFT", "TRANSFERRED"] } },
      select: { id: true, username: true },
      orderBy: { username: "asc" },
    }),
  ]);
  if (!duel) notFound();

  const pendingDays = new Set(pendingChanges.map((change) => change.eventDay).filter(Boolean));
  const dataDays = duel.days.filter((day) => day.hasData);
  const totalByMember = new Map<string, { memberId: string; memberName: string; total: number }>();
  const totalByEnemy = new Map<string, { playerName: string; total: number }>();
  const zeroPointMembers = new Set<string>();
  const noDataMembers = new Set<string>();

  for (const day of dataDays) {
    const allyScores = day.scores.filter((score) => score.side === "ALLY" && score.memberId);
    for (const score of day.scores.filter((score) => score.side === "ENEMY")) {
      const key = score.playerName;
      totalByEnemy.set(key, { playerName: key, total: (totalByEnemy.get(key)?.total ?? 0) + score.points });
    }
    const scoredMembers = new Set(allyScores.map((score) => score.memberId));
    for (const score of allyScores) {
      const memberName = score.member?.username ?? score.playerName;
      const current = totalByMember.get(score.memberId!) ?? { memberId: score.memberId!, memberName, total: 0 };
      current.total += score.points;
      totalByMember.set(score.memberId!, current);
      if (score.points === 0) zeroPointMembers.add(memberName);
    }
    for (const member of activeMembers) {
      if (!scoredMembers.has(member.id)) noDataMembers.add(member.username);
    }
  }

  const detail: DuelDetailData = {
    id: duel.id,
    startDate: duel.startDate.toISOString(),
    endDate: duel.endDate.toISOString(),
    opponentTag: duel.opponentTag,
    opponentName: duel.opponentName,
    status: duel.status,
    outcome: duel.outcome,
    days: duel.days.map((day) => ({
      id: day.id,
      dayNumber: day.dayNumber,
      date: day.date.toISOString(),
      pointValue: day.pointValue,
      hasData: day.hasData,
      dayOutcome: day.dayOutcome,
      allyTotalPoints: day.allyTotalPoints,
      enemyTotalPoints: day.enemyTotalPoints,
      pendingUpload: pendingDays.has(day.dayNumber),
      uploadEnabled: canUploadDuelDay({ role: user.role, status: duel.status, dayDate: day.date }),
      scores: day.scores.map((score) => ({
        id: score.id,
        memberName: score.member?.username ?? score.playerName,
        playerName: score.playerName,
        side: score.side,
        points: score.points,
      })),
    })),
    summary: {
      countsByDay: duel.days.map((day) => ({
        dayNumber: day.dayNumber,
        count: day.hasData ? day.scores.length : 0,
        outcome: day.dayOutcome,
        hasData: day.hasData,
      })),
      topContributors: [...totalByMember.values()].sort((a, b) => b.total - a.total).slice(0, 5),
      topEnemies: [...totalByEnemy.values()].sort((a, b) => b.total - a.total).slice(0, 5),
      noDataMembers: [...noDataMembers].sort((a, b) => a.localeCompare(b)),
      zeroPointMembers: [...zeroPointMembers].sort((a, b) => a.localeCompare(b)),
    },
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={duel.opponentName ?? duel.opponentTag ?? t("title")}
        subtitle={`${duel.startDate.toISOString().slice(0, 10)} - ${duel.endDate.toISOString().slice(0, 10)}`}
      />
      <AllianceDuelDetail duel={detail} isAdmin={user.role === "admin"} />
    </div>
  );
}
