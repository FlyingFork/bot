import { prisma } from "@tiles-survive/database";
import { createAuditLog } from "@/lib/audit";
import { jsonSafe, pickSnapshot } from "@/lib/json";
import type { UploadRow } from "@/lib/uploads";
export { PARTICIPANT_LIMIT, RESERVIST_LIMIT } from "@/lib/phase6-constants";

export function isSundayUtc(date: Date) {
  return date.getUTCDay() === 0;
}

export function dateInputToUtcMidnight(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function combineUtcDateTime(dateValue: string, timeValue: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return null;
  if (!/^\d{2}:\d{2}$/.test(timeValue)) return null;
  const dt = new Date(`${dateValue}T${timeValue}:00.000Z`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function isRaidDateReached(raidDate: Date, now = new Date()) {
  return now >= raidDate;
}

export function isRaidWithinUnmatchedWarningWindow(startsAt: Date, now = new Date()) {
  return startsAt.getTime() - now.getTime() <= 86_400_000;
}

function normalizeStr(value: string) {
  return value.trim().toLowerCase();
}

export async function matchMemberByName(playerName: string) {
  const members = await prisma.allianceMember.findMany({
    select: {
      id: true,
      username: true,
      isTempAway: true,
      nameHistory: { select: { name: true } },
    },
  });
  const target = normalizeStr(playerName);
  for (const member of members) {
    if (normalizeStr(member.username) === target) return member;
    if (member.nameHistory.some((h) => normalizeStr(h.name) === target)) return member;
  }
  return null;
}

export async function matchParticipantByName(planId: string, playerName: string) {
  const participants = await prisma.reservoirRaidParticipant.findMany({
    where: { planId },
    select: {
      id: true,
      username: true,
      memberId: true,
      member: {
        select: {
          username: true,
          nameHistory: { select: { name: true } },
        },
      },
    },
  });
  const target = normalizeStr(playerName);
  return participants.find((p) => {
    if (normalizeStr(p.username) === target) return true;
    if (p.member && normalizeStr(p.member.username) === target) return true;
    return p.member?.nameHistory.some((history) => normalizeStr(history.name) === target) ?? false;
  }) ?? null;
}

export async function applyRaidResultsUpload({
  planId,
  rows,
  pendingChangeId,
  actorId,
  action,
}: {
  planId: string;
  rows: UploadRow[];
  pendingChangeId?: string | null;
  actorId: string;
  action: string;
}) {
  void pendingChangeId;
  const plan = await prisma.reservoirRaidPlan.findUnique({
    where: { id: planId },
    include: {
      participants: {
        select: {
          id: true,
          username: true,
          member: {
            select: {
              username: true,
              nameHistory: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  if (!plan) throw new Error("Raid plan not found");

  const participantsByName = new Map<string, string>();
  for (const participant of plan.participants) {
    const names = [
      participant.username,
      participant.member?.username,
      ...(participant.member?.nameHistory.map((history) => history.name) ?? []),
    ].filter((name): name is string => Boolean(name));
    for (const name of names) {
      if (!participantsByName.has(normalizeStr(name))) {
        participantsByName.set(normalizeStr(name), participant.id);
      }
    }
  }

  return prisma.$transaction(async (tx) => {
    for (const row of rows) {
      const playerName = String(row.playerName ?? "");
      const participantId = participantsByName.get(normalizeStr(playerName));
      if (participantId && typeof row.waterCollected === "number") {
        await tx.reservoirRaidParticipant.update({
          where: { id: participantId },
          data: { waterCollected: row.waterCollected },
        });
      }
    }
    await createAuditLog(
      actorId,
      action,
      "ReservoirRaidPlan",
      planId,
      undefined,
      pickSnapshot(jsonSafe(plan)),
      tx,
    );
  });
}

export function totalSquadPower(powers: { power: bigint | string | number }[]) {
  return powers.reduce((sum, p) => sum + Number(p.power), 0);
}
