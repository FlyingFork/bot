import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@tiles-survive/database";
import { createAuditLog } from "@/lib/audit";
import { notifyR4Plus } from "@/lib/notifications";
import { apiError, requireAdmin } from "@/lib/server-auth";
import { addUtcDays, dateInputToUtcMidnight, isMondayUtc, pointValueForDay } from "@/lib/phase5";
import { jsonSafe, pickSnapshot } from "@/lib/json";

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAdmin();
    const body = (await request.json()) as {
      startDate?: string;
      opponentTag?: string | null;
      opponentName?: string | null;
    };

    const startDate = dateInputToUtcMidnight(body.startDate);
    if (!startDate || !isMondayUtc(startDate)) {
      return NextResponse.json({ errorCode: "mondayRequired" }, { status: 400 });
    }

    const endDate = addUtcDays(startDate, 6);
    const opponentTag = body.opponentTag?.trim() || null;
    const opponentName = body.opponentName?.trim() || null;

    const instance = await prisma.allianceDuelInstance.create({
      data: {
        startDate,
        endDate,
        opponentTag,
        opponentName,
        createdById: actor.id,
        days: {
          create: [1, 2, 3, 4, 5, 6].map((dayNumber) => ({
            dayNumber,
            date: addUtcDays(startDate, dayNumber - 1),
            pointValue: pointValueForDay(dayNumber),
          })),
        },
      },
      include: { days: true },
    });

    await createAuditLog(actor.id, "DUEL_INSTANCE_CREATED", "AllianceDuelInstance", instance.id, undefined, pickSnapshot(jsonSafe(instance)));
    await notifyR4Plus(
      "EVENT_CREATED",
      "eventCreated",
      { eventName: opponentName ?? opponentTag ?? "Alliance Duel" },
      { allianceDuelInstanceId: instance.id },
    );

    return NextResponse.json(jsonSafe({ ok: true, instance }));
  } catch (error) {
    return apiError(error);
  }
}
