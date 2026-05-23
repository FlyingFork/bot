import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@tiles-survive/database";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { RaidPlanWorkspace } from "@/components/reservoir-raid/RaidPlanWorkspace";
import { OBJECTIVE_IDS } from "@/data/tilessurvive-objectives";
import type { ObjectiveId } from "@/types/objectives";

export const dynamic = "force-dynamic";

const avatarColors = [
  "bg-cn-cyan/15 text-cn-cyan",
  "bg-cn-success/15 text-cn-success",
  "bg-cn-warning/15 text-cn-warning",
  "bg-cn-danger/15 text-cn-danger",
  "bg-text-secondary/15 text-text-primary",
  "bg-overlay text-text-secondary",
];

function usernameColor(username: string) {
  const hash = Array.from(username).reduce(
    (value, character) => value + character.charCodeAt(0),
    0,
  );

  return avatarColors[hash % avatarColors.length];
}

function initials(username: string) {
  return Array.from(username).slice(0, 2).join("").toUpperCase();
}

function serializedAssignments(
  assignments: { objectiveId: string; participantId: string }[],
) {
  return assignments.flatMap((assignment) =>
    OBJECTIVE_IDS.has(assignment.objectiveId as ObjectiveId)
      ? [
          {
            objectiveId: assignment.objectiveId as ObjectiveId,
            participantId: assignment.participantId,
          },
        ]
      : [],
  );
}

export default async function ReservoirRaidPlanPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const [objectiveT, t] = await Promise.all([
    getTranslations("objectives"),
    getTranslations("reservoirRaid.plan"),
  ]);
  const { planId } = await params;
  const [plan, allianceMembers] = await Promise.all([
    prisma.reservoirRaidPlan.findUnique({
      where: { id: planId },
      include: {
        assignments: {
          select: {
            objectiveId: true,
            participantId: true,
          },
        },
        participants: {
          orderBy: { username: "asc" },
          include: {
            member: {
              select: {
                id: true,
                active: true,
              },
            },
            squadPowers: {
              orderBy: { squadIndex: "asc" },
              select: {
                power: true,
                squadIndex: true,
              },
            },
          },
        },
      },
    }),
    prisma.allianceMember.findMany({
      where: { active: true },
      orderBy: { username: "asc" },
      select: {
        id: true,
        username: true,
      },
    }),
  ]);

  if (!plan) {
    notFound();
  }

  const participants = plan.participants.map((participant) => {
    const totalSquadPower = participant.squadPowers.reduce(
      (total, squad) => total + squad.power,
      BigInt(0),
    );

    return {
      id: participant.id,
      username: participant.username,
      memberId: participant.memberId,
      memberActive: participant.member?.active ?? false,
      contactType: participant.contactType,
      contact: participant.contact,
      confirmed: participant.confirmed,
      participant: participant.participant,
      reservist: participant.reservist,
      updatedAt: participant.updatedAt.toISOString(),
      squadPowers: participant.squadPowers.map((squad) => ({
        squadIndex: squad.squadIndex,
        power: squad.power.toString(),
      })),
      totalSquadPower: totalSquadPower.toString(),
      avatarColor: usernameColor(participant.username),
      avatarInitials: initials(participant.username),
    };
  });

  return (
    <div className="flex flex-col gap-6 animate-fade-up">
      <PageHeader
        title={objectiveT("title")}
        subtitle={t("weeklyPlan", { date: plan.raidDate.toISOString().slice(0, 10) })}
        action={
          <Link
            href="/dashboard/events/reservoir-raid"
            className={buttonVariants({ variant: "outline" })}
          >
            {t("allWeeks")}
          </Link>
        }
      />
      <RaidPlanWorkspace
        allianceMembers={allianceMembers.map((member) => ({
          id: member.id,
          username: member.username,
          avatarColor: usernameColor(member.username),
          avatarInitials: initials(member.username),
        }))}
        members={participants.map((participant) => ({
          id: participant.id,
          username: participant.username,
          memberId: participant.memberId,
          totalSquadPower: participant.totalSquadPower,
          participant: participant.participant,
          reservist: participant.reservist,
          avatarColor: participant.avatarColor,
          avatarInitials: participant.avatarInitials,
        }))}
        participants={participants}
        plan={{
          id: plan.id,
          publicToken: plan.publicToken,
          raidDate: plan.raidDate.toISOString(),
          registrationOpen: plan.registrationOpen,
          startsAt: plan.startsAt.toISOString(),
          assignmentPlan: {
            id: plan.id,
            updatedAt: plan.updatedAt.toISOString(),
            assignments: serializedAssignments(plan.assignments),
          },
        }}
      />
    </div>
  );
}
