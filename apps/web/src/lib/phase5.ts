import { prisma, type DuelOutcome, type EventStatus } from "@tiles-survive/database";
import { createAuditLog } from "@/lib/audit";
import { jsonSafe, pickSnapshot } from "@/lib/json";
import {
  resolveRowsForApply,
  rowSide,
  type UploadResolutionData,
  type UploadRow,
} from "@/lib/uploads";

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
  resolutionData,
  pendingChangeId,
  actorId,
  action,
}: {
  instanceId: string;
  dayNumber: number;
  rows: UploadRow[];
  resolutionData?: UploadResolutionData | null;
  pendingChangeId?: string | null;
  actorId: string;
  action: string;
}) {
  const day = await prisma.allianceDuelDay.findUnique({
    where: { instanceId_dayNumber: { instanceId, dayNumber } },
    include: { scores: true, instance: true },
  });
  if (!day) throw new Error("Duel day not found");

  return prisma.$transaction(async (tx) => {
    const matched = await resolveRowsForApply({ rows, resolutionData, tx: tx as typeof prisma });
    const unmatched = matched.filter((item) => rowSide(item.row) === "ALLY" && !item.memberId);
    if (unmatched.length > 0) {
      const error = new Error("Unmatched duel rows");
      error.name = "UNMATCHED_DUEL_ROWS";
      throw error;
    }
    const allyTotal = matched
      .filter((item) => rowSide(item.row) === "ALLY")
      .reduce((sum, item) => sum + Number(item.row.points), 0);
    const enemyTotal = matched
      .filter((item) => rowSide(item.row) === "ENEMY")
      .reduce((sum, item) => sum + Number(item.row.points), 0);
    const dayOutcome = isUtcDayReached(addUtcDays(day.date, 1))
      ? calculateOutcome(allyTotal, enemyTotal)
      : day.dayOutcome;

    await tx.allianceDuelScore.deleteMany({ where: { dayId: day.id } });
    await tx.allianceDuelScore.createMany({
      data: matched.map((item) => {
        const side = rowSide(item.row);
        return {
          dayId: day.id,
          side,
          memberId: side === "ALLY" ? item.memberId : null,
          playerName: String(item.row.playerName),
          points: Number(item.row.points),
        };
      }),
    });

    const updated = await tx.allianceDuelDay.update({
      where: { id: day.id },
      data: {
        hasData: true,
        changeRequestId: pendingChangeId ?? null,
        allyTotalPoints: allyTotal,
        enemyTotalPoints: enemyTotal,
        dayOutcome,
      },
      include: { scores: { include: { member: { select: { username: true } } } } },
    });

    await recalculateAllianceDuelInstance(instanceId, tx as typeof prisma);

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
  }, { timeout: 30_000 });
}

export function calculateOutcome(allyTotal: number, enemyTotal: number): DuelOutcomeValue {
  if (allyTotal > enemyTotal) return "WIN";
  if (allyTotal < enemyTotal) return "LOSS";
  return "DRAW";
}

export async function recalculateAllianceDuelInstance(instanceId: string, client: typeof prisma = prisma) {
  const instance = await client.allianceDuelInstance.findUnique({
    where: { id: instanceId },
    include: { days: { orderBy: { dayNumber: "asc" } } },
  });
  if (!instance) return null;

  let allyEventPoints = 0;
  let enemyEventPoints = 0;
  for (const day of instance.days) {
    if (!day.hasData) continue;
    const nextOutcome = isUtcDayReached(addUtcDays(day.date, 1))
      ? calculateOutcome(day.allyTotalPoints, day.enemyTotalPoints)
      : day.dayOutcome;
    if (nextOutcome !== day.dayOutcome) {
      await client.allianceDuelDay.update({ where: { id: day.id }, data: { dayOutcome: nextOutcome } });
    }
    if (nextOutcome === "WIN") allyEventPoints += day.pointValue;
    else if (nextOutcome === "LOSS") enemyEventPoints += day.pointValue;
  }

  const hasData = instance.days.some((day) => day.hasData);
  const canCalculateInstance = hasData && isUtcDayReached(addUtcDays(instance.endDate, 1));
  const outcome = canCalculateInstance ? calculateOutcome(allyEventPoints, enemyEventPoints) : instance.outcome;
  const status = canCalculateInstance ? "ENDED" : instance.status;
  if (outcome !== instance.outcome || status !== instance.status) {
    return client.allianceDuelInstance.update({ where: { id: instance.id }, data: { outcome, status } });
  }
  return instance;
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
