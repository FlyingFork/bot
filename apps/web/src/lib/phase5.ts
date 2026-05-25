import { prisma, type DuelOutcome, type EventStatus } from "@tiles-survive/database";
import { createAuditLog } from "@/lib/audit";
import { jsonSafe, pickSnapshot } from "@/lib/json";
import { matchUploadRows, type UploadRow } from "@/lib/uploads";

export const DUEL_OUTCOMES = ["WIN", "LOSS", "DRAW"] as const;
export const DUEL_STATUSES = ["ACTIVE", "ENDED"] as const;

export type DuelOutcomeValue = (typeof DUEL_OUTCOMES)[number];
export type DuelStatusValue = (typeof DUEL_STATUSES)[number];

export function dateInputToUtcMidnight(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function dateToInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function isMondayUtc(date: Date) {
  return date.getUTCDay() === 1;
}

export function isUtcDayReached(targetDate: Date, now = new Date()) {
  return now >= targetDate;
}

export function pointValueForDay(dayNumber: number) {
  if (dayNumber === 1) return 1;
  if (dayNumber === 6) return 4;
  return 2;
}

export function dayLabelKey(dayNumber: number) {
  return `day${dayNumber}` as const;
}

export function normalizeOutcome(value: unknown): DuelOutcomeValue | null {
  return typeof value === "string" && DUEL_OUTCOMES.includes(value as DuelOutcomeValue)
    ? (value as DuelOutcomeValue)
    : null;
}

export function normalizeStatus(value: unknown): DuelStatusValue | null {
  return typeof value === "string" && DUEL_STATUSES.includes(value as DuelStatusValue)
    ? (value as DuelStatusValue)
    : null;
}

export function canUploadDuelDay({
  role,
  status,
  dayDate,
}: {
  role: string | null | undefined;
  status: EventStatus | string;
  dayDate: Date;
}) {
  if (role === "admin") return true;
  return status === "ACTIVE" && isUtcDayReached(dayDate);
}

export async function applyAllianceDuelDayUpload({
  instanceId,
  dayNumber,
  rows,
  pendingChangeId,
  actorId,
  action,
}: {
  instanceId: string;
  dayNumber: number;
  rows: UploadRow[];
  pendingChangeId?: string | null;
  actorId: string;
  action: string;
}) {
  const day = await prisma.allianceDuelDay.findUnique({
    where: { instanceId_dayNumber: { instanceId, dayNumber } },
    include: { scores: true },
  });
  if (!day) throw new Error("Duel day not found");

  const matched = await matchUploadRows(rows);
  const unmatched = matched.filter((item) => !item.memberId);
  if (unmatched.length > 0) {
    const error = new Error("Unmatched duel rows");
    error.name = "UNMATCHED_DUEL_ROWS";
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    await tx.allianceDuelScore.deleteMany({ where: { dayId: day.id } });
    for (const item of matched) {
      await tx.allianceDuelScore.create({
        data: {
          dayId: day.id,
          memberId: item.memberId!,
          points: Number(item.row.points),
        },
      });
    }

    const updated = await tx.allianceDuelDay.update({
      where: { id: day.id },
      data: { hasData: true, changeRequestId: pendingChangeId ?? null },
      include: { scores: { include: { member: { select: { username: true } } } } },
    });

    await createAuditLog(
      actorId,
      action,
      "AllianceDuelDay",
      day.id,
      pickSnapshot(jsonSafe(day)),
      pickSnapshot(jsonSafe(updated)),
      tx,
    );

    return updated;
  });
}

export function duelRecordLabel(record: { wins: number; losses: number; draws: number }) {
  return `${record.wins}/${record.losses}/${record.draws}`;
}

export function outcomeRecord<T extends { outcome: DuelOutcome | null }>(items: T[]) {
  return items.reduce(
    (record, item) => {
      if (item.outcome === "WIN") record.wins += 1;
      else if (item.outcome === "LOSS") record.losses += 1;
      else if (item.outcome === "DRAW") record.draws += 1;
      return record;
    },
    { wins: 0, losses: 0, draws: 0 },
  );
}
