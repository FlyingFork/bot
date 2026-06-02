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

  // Second round — needs duel.startDate and duel.opponentTag
  const [prevDuel, h2hDuels] = await Promise.all([
    prisma.allianceDuelInstance.findFirst({
      where: { startDate: { lt: duel.startDate }, status: "ENDED" },
      orderBy: { startDate: "desc" },
      select: {
        id: true,
        startDate: true,
        opponentName: true,
        outcome: true,
        days: {
          select: {
            hasData: true,
            dayOutcome: true,
            allyTotalPoints: true,
            scores: {
              where: { side: "ALLY" },
              select: {
                memberId: true,
                playerName: true,
                points: true,
                member: { select: { username: true } },
              },
            },
          },
        },
      },
    }),
    duel.opponentTag
      ? prisma.allianceDuelInstance.findMany({
          where: { opponentTag: duel.opponentTag, id: { not: id }, outcome: { not: null } },
          select: { id: true, startDate: true, outcome: true },
          orderBy: { startDate: "desc" },
        })
      : Promise.resolve([] as Array<{ id: string; startDate: Date; outcome: string }>),
  ]);

  // ── Analytics ────────────────────────────────────────────────────────────────
  const pendingDays = new Set(pendingChanges.map((c) => c.eventDay).filter(Boolean));
  const dataDays = duel.days.filter((d) => d.hasData);

  const totalByMember = new Map<string, { memberId: string; memberName: string; total: number }>();
  const totalByEnemy = new Map<string, { playerName: string; total: number }>();
  const zeroPointMembers = new Set<string>();
  const noDataMembers = new Set<string>();
  const perDayMemberSets: Set<string>[] = [];

  for (const day of dataDays) {
    const allyScores = day.scores.filter((s) => s.side === "ALLY" && s.memberId);
    const dayMemberIds = new Set(allyScores.map((s) => s.memberId!));
    perDayMemberSets.push(dayMemberIds);

    for (const score of day.scores.filter((s) => s.side === "ENEMY")) {
      const key = score.playerName;
      totalByEnemy.set(key, { playerName: key, total: (totalByEnemy.get(key)?.total ?? 0) + Number(score.points) });
    }
    for (const score of allyScores) {
      const memberName = score.member?.username ?? score.playerName;
      const current = totalByMember.get(score.memberId!) ?? { memberId: score.memberId!, memberName, total: 0 };
      current.total += Number(score.points);
      totalByMember.set(score.memberId!, current);
      if (score.points === BigInt(0)) zeroPointMembers.add(memberName);
    }
    for (const member of activeMembers) {
      if (!dayMemberIds.has(member.id)) noDataMembers.add(member.username);
    }
  }

  // Perfect attendance: appeared in every data day
  let perfectAttendanceMembers: string[] = [];
  if (perDayMemberSets.length > 0) {
    const perfectSet = new Set(perDayMemberSets[0]);
    for (const set of perDayMemberSets.slice(1)) {
      for (const mid of [...perfectSet]) {
        if (!set.has(mid)) perfectSet.delete(mid);
      }
    }
    perfectAttendanceMembers = [...perfectSet]
      .map((mid) => totalByMember.get(mid)?.memberName ?? mid)
      .sort((a, b) => a.localeCompare(b));
  }

  // Grand totals
  const totalAllyPoints = duel.days.reduce((s, d) => s + Number(d.allyTotalPoints), 0);
  const totalEnemyPoints = duel.days.reduce((s, d) => s + Number(d.enemyTotalPoints), 0);

  // Best / worst day by ally points
  const allyByDay = dataDays.map((d) => ({ dayNumber: d.dayNumber, allyPoints: Number(d.allyTotalPoints) }));
  const bestDay = allyByDay.length > 0 ? allyByDay.reduce((a, b) => (b.allyPoints > a.allyPoints ? b : a)) : null;
  const worstDay = allyByDay.length > 0 ? allyByDay.reduce((a, b) => (b.allyPoints < a.allyPoints ? b : a)) : null;

  // Longest consecutive win / loss streak
  let dayWinStreak = 0, dayLossStreak = 0, curStreak = 0;
  for (const day of duel.days) {
    if (day.dayOutcome === "WIN") {
      curStreak = curStreak >= 0 ? curStreak + 1 : 1;
      if (curStreak > dayWinStreak) dayWinStreak = curStreak;
    } else if (day.dayOutcome === "LOSS") {
      curStreak = curStreak <= 0 ? curStreak - 1 : -1;
      if (-curStreak > dayLossStreak) dayLossStreak = -curStreak;
    } else {
      curStreak = 0;
    }
  }

  // MVP: top contributor + best single-day score
  const sortedContributors = [...totalByMember.values()].sort((a, b) => b.total - a.total);
  let mvp: DuelDetailData["overview"]["mvp"] = null;
  if (sortedContributors.length > 0) {
    const top = sortedContributors[0];
    let bestDayPts = 0, bestDayNumber = 1;
    for (const day of dataDays) {
      for (const score of day.scores) {
        if (score.side === "ALLY" && score.memberId === top.memberId) {
          const pts = Number(score.points);
          if (pts > bestDayPts) { bestDayPts = pts; bestDayNumber = day.dayNumber; }
        }
      }
    }
    mvp = { memberName: top.memberName, total: top.total, bestDayPts, bestDayNumber };
  }

  // Concentration: top-3 share of total ally points
  const top3Total = sortedContributors.slice(0, 3).reduce((s, m) => s + m.total, 0);
  const concentrationPct =
    totalAllyPoints > 0 && sortedContributors.length >= 3
      ? Math.round((top3Total / totalAllyPoints) * 100)
      : null;

  // Top contributors + enemies with share %
  const topContributors = sortedContributors.slice(0, 5).map((m) => ({
    ...m,
    sharePct: totalAllyPoints > 0 ? Math.round((m.total / totalAllyPoints) * 100) : 0,
  }));
  const sortedEnemies = [...totalByEnemy.values()].sort((a, b) => b.total - a.total);
  const totalEnemyScored = sortedEnemies.reduce((s, e) => s + e.total, 0);
  const topEnemies = sortedEnemies.slice(0, 5).map((e) => ({
    ...e,
    sharePct: totalEnemyScored > 0 ? Math.round((e.total / totalEnemyScored) * 100) : 0,
  }));

  // Previous duel stats
  let prevDuelData: DuelDetailData["overview"]["prevDuel"] = null;
  if (prevDuel) {
    const prevDataDays = prevDuel.days.filter((d) => d.hasData);
    const prevTotalAlly = prevDuel.days.reduce((s, d) => s + Number(d.allyTotalPoints), 0);
    const prevDaysWon = prevDuel.days.filter((d) => d.dayOutcome === "WIN").length;
    const prevMemberTotals = new Map<string, { name: string; total: number }>();
    for (const day of prevDataDays) {
      for (const score of day.scores) {
        const name = score.member?.username ?? score.playerName;
        const key = score.memberId ?? score.playerName;
        const cur = prevMemberTotals.get(key) ?? { name, total: 0 };
        cur.total += Number(score.points);
        prevMemberTotals.set(key, cur);
      }
    }
    const prevTopScorer = [...prevMemberTotals.values()].sort((a, b) => b.total - a.total)[0] ?? null;
    const prevAvgPart =
      prevDataDays.length > 0
        ? prevDataDays.reduce((s, d) => s + d.scores.length, 0) / prevDataDays.length
        : null;
    prevDuelData = {
      id: prevDuel.id,
      startDate: prevDuel.startDate.toISOString(),
      opponentName: prevDuel.opponentName,
      outcome: prevDuel.outcome,
      totalAllyPoints: prevTotalAlly,
      daysWon: prevDaysWon,
      topScorer: prevTopScorer ? { name: prevTopScorer.name, total: prevTopScorer.total } : null,
      avgParticipation: prevAvgPart,
    };
  }

  // H2H record
  let h2hData: DuelDetailData["overview"]["h2h"] = null;
  if (duel.opponentTag) {
    const pastDuels = h2hDuels.map((d) => ({
      id: d.id,
      startDate: d.startDate.toISOString(),
      outcome: d.outcome as string,
    }));
    const allForRecord = [
      ...(duel.outcome ? [{ outcome: duel.outcome }] : []),
      ...h2hDuels.map((d) => ({ outcome: d.outcome as string })),
    ];
    h2hData = {
      opponentTag: duel.opponentTag,
      wins: allForRecord.filter((d) => d.outcome === "WIN").length,
      losses: allForRecord.filter((d) => d.outcome === "LOSS").length,
      draws: allForRecord.filter((d) => d.outcome === "DRAW").length,
      pastDuels,
    };
  }

  // ── Build detail object ───────────────────────────────────────────────────────
  const detail: DuelDetailData = {
    id: duel.id,
    startDate: duel.startDate.toISOString(),
    endDate: duel.endDate.toISOString(),
    opponentTag: duel.opponentTag,
    opponentName: duel.opponentName,
    status: duel.status,
    outcome: duel.outcome,
    activeRosterCount: activeMembers.length,
    days: duel.days.map((day) => ({
      id: day.id,
      dayNumber: day.dayNumber,
      date: day.date.toISOString(),
      pointValue: day.pointValue,
      hasData: day.hasData,
      dayOutcome: day.dayOutcome,
      allyTotalPoints: Number(day.allyTotalPoints),
      enemyTotalPoints: Number(day.enemyTotalPoints),
      pendingUpload: pendingDays.has(day.dayNumber),
      uploadEnabled: canUploadDuelDay({ role: user.role, status: duel.status, dayDate: day.date }),
      scores: day.scores.map((score) => ({
        id: score.id,
        memberId: score.memberId,
        memberName: score.member?.username ?? score.playerName,
        playerName: score.playerName,
        side: score.side,
        points: Number(score.points),
      })),
    })),
    summary: {
      countsByDay: duel.days.map((day) => ({
        dayNumber: day.dayNumber,
        count: day.hasData ? day.scores.filter((s) => s.side === "ALLY").length : 0,
        outcome: day.dayOutcome,
        hasData: day.hasData,
      })),
      topContributors,
      topEnemies,
      noDataMembers: [...noDataMembers].sort((a, b) => a.localeCompare(b)),
      zeroPointMembers: [...zeroPointMembers].sort((a, b) => a.localeCompare(b)),
      perfectAttendanceMembers,
      bestDay,
      worstDay,
      concentrationPct,
    },
    overview: {
      totalAllyPoints,
      totalEnemyPoints,
      dayWinStreak,
      dayLossStreak,
      mvp,
      prevDuel: prevDuelData,
      h2h: h2hData,
    },
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={duel.opponentName ?? duel.opponentTag ?? t("title")}
        subtitle={`${duel.startDate.toISOString().slice(0, 10)} - ${duel.endDate.toISOString().slice(0, 10)}`}
      />
      <AllianceDuelDetail duel={detail} isAdmin={user.role === "admin"} userMemberId={user.allianceMemberId ?? null} />
    </div>
  );
}
