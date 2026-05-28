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
            member: { select: { username: true } },
            squadPowers: { orderBy: { squadIndex: "asc" } },
          },
        },
        objectives: {
          orderBy: { tier: "asc" },
          include: {
            assignments: {
              include: {
                participant: {
                  include: { squadPowers: true },
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
              include: { squadPowers: true },
            },
          },
        },
      },
    });
  }

  const participantRows: RaidParticipantRow[] = plan.participants.map((p) => {
    const cs = p.memberId ? contributionScores.get(p.memberId) : undefined;
    const wd = p.memberId ? waterByMember.get(p.memberId) : undefined;
    return {
      id: p.id,
      username: p.username,
      memberId: p.memberId,
      memberName: p.member?.username ?? null,
      contactType: p.contactType,
      contact: p.contact,
      registrationStatus: p.registrationStatus,
      waterCollected: p.waterCollected,
      totalSquadPower: totalSquadPower(p.squadPowers),
      squadPowers: p.squadPowers.map((sq) => ({ squadIndex: sq.squadIndex, power: Number(sq.power) })),
      raidReliability:
        cs && cs.raidTotal > 0
          ? { score: cs.raidScore, participated: cs.raidParticipated, total: cs.raidTotal }
          : null,
      lastWaterCollected: wd?.last ?? null,
      totalWaterCollected: wd ? wd.total : null,
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
        playerName: a.participant.username,
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
      />
    </div>
  );
}
