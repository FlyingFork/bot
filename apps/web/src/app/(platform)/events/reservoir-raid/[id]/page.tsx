import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@tiles-survive/database";
import { PageHeader } from "@/components/ui/page-header";
import {
  ReservoirRaidDetail,
  type RaidDetailData,
  type RaidParticipantRow,
  type RaidObjectiveRow,
  type MemberOption,
} from "@/components/phase6/ReservoirRaidDetail";
import { requireUser } from "@/lib/server-auth";
import { isRaidWithinUnmatchedWarningWindow, totalSquadPower } from "@/lib/phase6";
import { OBJECTIVE_DEFINITIONS } from "@/lib/raid-objectives";
import { getContributionScores, type ContributionScore } from "@/lib/phase4";
import {
  computePoolMaxValues,
  participantCompositeScore,
  type RaidParticipantLike,
} from "@/lib/raid-assignment";

type Props = { params: Promise<{ id: string }> };

export default async function ReservoirRaidDetailPage({ params }: Props) {
  const user = await requireUser();
  const { id } = await params;
  const t = await getTranslations("phase6.reservoirRaid");

  const [plan, members, pendingResults] = await Promise.all([
    prisma.reservoirRaidPlan.findUnique({
      where: { id },
      include: {
        participants: {
          orderBy: { createdAt: "asc" },
          include: {
            member: { select: { username: true, reservoirRaidScore: true, reservoirRaidScoreUpdatedAt: true } },
            squadPowers: { orderBy: { squadIndex: "asc" } },
          },
        },
        objectives: {
          orderBy: { tier: "asc" },
          include: {
            assignments: {
              include: {
                participant: {
                  include: {
                    member: { select: { username: true, reservoirRaidScore: true, reservoirRaidScoreUpdatedAt: true } },
                    squadPowers: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.allianceMember.findMany({
      where: { memberStatus: { notIn: ["LEFT", "TRANSFERRED"] } },
      select: { id: true, username: true },
      orderBy: { username: "asc" },
    }),
    prisma.pendingChange.findFirst({
      where: { type: "RESERVOIR_RAID_RESULTS", status: "PENDING", eventInstanceId: id },
      select: { id: true },
    }),
  ]);

  if (!plan) notFound();

  const matchedMemberIds = plan.participants.map((p) => p.memberId).filter((id): id is string => id !== null);

  const [contributionScores, waterHistory] = await Promise.all([
    matchedMemberIds.length > 0 ? getContributionScores(matchedMemberIds) : Promise.resolve(new Map<string, ContributionScore>()),
    matchedMemberIds.length > 0
      ? prisma.reservoirRaidParticipant.findMany({
          where: { memberId: { in: matchedMemberIds }, waterCollected: { not: null } },
          select: { memberId: true, waterCollected: true, plan: { select: { raidDate: true } } },
          orderBy: { plan: { raidDate: "desc" } },
        })
      : Promise.resolve([]),
  ]);

  const waterByMember = new Map<string, { last: number; total: number }>();
  for (const entry of waterHistory) {
    if (!entry.memberId || entry.waterCollected === null) continue;
    const existing = waterByMember.get(entry.memberId);
    if (!existing) {
      waterByMember.set(entry.memberId, { last: entry.waterCollected, total: entry.waterCollected });
    } else {
      existing.total += entry.waterCollected;
    }
  }

  let objectives = plan.objectives;
  if (objectives.length === 0) {
    await prisma.reservoirRaidObjective.createMany({
      data: OBJECTIVE_DEFINITIONS.map((def) => ({
        planId: plan.id,
        key: def.key,
        tier: def.tier,
        waterRate: def.waterRate,
        isAssignable: def.isAssignable,
        mapX: def.mapX,
        mapY: def.mapY,
      })),
    });
    objectives = await prisma.reservoirRaidObjective.findMany({
      where: { planId: plan.id },
      orderBy: { tier: "asc" },
      include: {
        assignments: {
          include: {
            participant: {
              include: {
                member: { select: { username: true } },
                squadPowers: true,
              },
            },
          },
        },
      },
    });
  }

  const STALE_THRESHOLD_MS = 10.5 * 24 * 60 * 60 * 1000; // 1.5 weeks

  // Build participant-like objects for composite score computation
  const participantLike: RaidParticipantLike[] = plan.participants.map((p) => ({
    id: p.id,
    username: p.member?.username ?? p.username,
    registrationStatus: p.registrationStatus,
    squad1Power: Number(p.squadPowers.find((sq) => sq.squadIndex === 1)?.power ?? 0),
    totalSquadPower: totalSquadPower(p.squadPowers),
    reservoirRaidScore: p.member?.reservoirRaidScore ?? null,
  }));
  const { maxRRS, maxSquad1 } = computePoolMaxValues(participantLike);

  // Assign composite-score tiers relative to this event's participants
  const scoredParticipants = participantLike
    .map((p) => ({ id: p.id, composite: participantCompositeScore(p, maxRRS, maxSquad1) }))
    .sort((a, b) => b.composite - a.composite);
  const tierByParticipantId = new Map<string, "high" | "mid" | "low" | "none">();
  const n = scoredParticipants.length;
  scoredParticipants.forEach((item, index) => {
    const hasScore = participantLike.find((p) => p.id === item.id)?.reservoirRaidScore != null;
    const hasSquad1 = (participantLike.find((p) => p.id === item.id)?.squad1Power ?? 0) > 0;
    if (!hasScore && !hasSquad1) {
      tierByParticipantId.set(item.id, "none");
    } else if (index < Math.ceil(n / 3)) {
      tierByParticipantId.set(item.id, "high");
    } else if (index < Math.ceil((2 * n) / 3)) {
      tierByParticipantId.set(item.id, "mid");
    } else {
      tierByParticipantId.set(item.id, "low");
    }
  });

  const now = Date.now();
  const participantRows: RaidParticipantRow[] = plan.participants.map((p) => {
    const cs = p.memberId ? contributionScores.get(p.memberId) : undefined;
    const wd = p.memberId ? waterByMember.get(p.memberId) : undefined;
    const displayName = p.member?.username ?? p.username;
    const rrsUpdatedAt = p.member?.reservoirRaidScoreUpdatedAt ?? null;
    const pLike = participantLike.find((pl) => pl.id === p.id)!;
    return {
      id: p.id,
      username: displayName,
      memberId: p.memberId,
      memberName: p.member?.username ?? null,
      contactType: p.contactType,
      contact: p.contact,
      registrationStatus: p.registrationStatus,
      waterCollected: p.waterCollected,
      squad1Power: pLike.squad1Power ?? 0,
      totalSquadPower: totalSquadPower(p.squadPowers),
      squadPowers: p.squadPowers.map((sq) => ({ squadIndex: sq.squadIndex, power: Number(sq.power) })),
      raidReliability:
        cs && cs.raidTotal > 0
          ? { score: cs.raidScore, participated: cs.raidParticipated, total: cs.raidTotal }
          : null,
      lastWaterCollected: wd?.last ?? null,
      totalWaterCollected: wd ? wd.total : null,
      reservoirRaidScore: p.member?.reservoirRaidScore ?? null,
      reservoirRaidScoreUpdatedAt: rrsUpdatedAt ? rrsUpdatedAt.toISOString() : null,
      compositeScore: participantCompositeScore(pLike, maxRRS, maxSquad1),
      compositeScoreTier: tierByParticipantId.get(p.id) ?? "none",
      isScoreStale: rrsUpdatedAt != null && now - rrsUpdatedAt.getTime() > STALE_THRESHOLD_MS,
    };
  });

  const objectiveRows: RaidObjectiveRow[] = objectives.map((obj) => ({
    id: obj.id,
    key: obj.key,
    tier: obj.tier,
    waterRate: obj.waterRate,
    isAssignable: obj.isAssignable,
    mapX: obj.mapX,
    mapY: obj.mapY,
    assignments: obj.assignments.map((a) => {
      const squad1Power = a.participant.squadPowers.find((sq) => sq.squadIndex === 1)?.power ?? 0;
      return {
        participantId: a.participantId,
        playerName: a.participant.member?.username ?? a.participant.username,
        squad1Power: Number(squad1Power),
        totalSquadPower: totalSquadPower(a.participant.squadPowers),
        registrationStatus: a.participant.registrationStatus,
        contactType: a.participant.contactType,
        contact: a.participant.contact,
      };
    }),
  }));

  const memberOptions: MemberOption[] = members.map((m) => ({ id: m.id, username: m.username }));

  const raid: RaidDetailData = {
    id: plan.id,
    publicToken: plan.publicToken,
    raidDate: plan.raidDate.toISOString(),
    startsAt: plan.startsAt.toISOString(),
    status: plan.status,
    registrationOpen: plan.registrationOpen,
    participants: participantRows,
    objectives: objectiveRows,
    pendingResults: !!pendingResults,
    showUnmatchedWarning: isRaidWithinUnmatchedWarningWindow(plan.startsAt),
  };

  const raidDateDisplay = new Date(plan.raidDate).toLocaleDateString();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${t("title")} — ${raidDateDisplay}`}
        subtitle={plan.registrationOpen ? t("registrationOpen") : t("registrationClosed")}
      />
      <ReservoirRaidDetail
        raid={raid}
        members={memberOptions}
        isAdmin={user.role === "admin"}
        role={user.role ?? "r1"}
        userLanguage={(user.language as string) ?? "en"}
        userMemberId={user.allianceMemberId ?? null}
      />
    </div>
  );
}
