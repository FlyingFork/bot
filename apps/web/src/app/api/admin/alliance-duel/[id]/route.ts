import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@tiles-survive/database";
import { createAuditLog } from "@/lib/audit";
import { apiError, requireAdmin } from "@/lib/server-auth";
import { addUtcDays, dateInputToUtcMidnight, isMondayUtc, normalizeOutcome, normalizeStatus } from "@/lib/phase5";
import { jsonSafe, pickSnapshot } from "@/lib/json";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Params) {
  try {
    const actor = await requireAdmin();
    const { id } = await context.params;
    const body = (await request.json()) as {
      startDate?: string;
      endDate?: string;
      opponentTag?: string | null;
      opponentName?: string | null;
      outcome?: string | null;
      status?: string;
    };

    const before = await prisma.allianceDuelInstance.findUnique({ where: { id }, include: { days: true } });
    if (!before) return NextResponse.json({ errorCode: "notFound" }, { status: 404 });

    const startDate = dateInputToUtcMidnight(body.startDate);
    const endDate = dateInputToUtcMidnight(body.endDate);
    if (!startDate || !isMondayUtc(startDate)) {
      return NextResponse.json({ errorCode: "mondayRequired" }, { status: 400 });
    }
    if (!endDate || endDate < startDate) {
      return NextResponse.json({ errorCode: "invalidEndDate" }, { status: 400 });
    }

    const status = normalizeStatus(body.status) ?? before.status;
    const outcome = body.outcome ? normalizeOutcome(body.outcome) : null;
    if (body.outcome && !outcome) return NextResponse.json({ errorCode: "invalidOutcome" }, { status: 400 });

    const updated = await prisma.$transaction(async (tx) => {
      const instance = await tx.allianceDuelInstance.update({
        where: { id },
        data: {
          startDate,
          endDate,
          opponentTag: body.opponentTag?.trim() || null,
          opponentName: body.opponentName?.trim() || null,
          status,
          outcome,
        },
        include: { days: true },
      });

      for (const day of before.days) {
        await tx.allianceDuelDay.update({
          where: { id: day.id },
          data: {
            date: addUtcDays(startDate, day.dayNumber - 1),
            pointValue: day.pointValue,
          },
        });
      }

      await createAuditLog(actor.id, "DUEL_INSTANCE_EDITED", "AllianceDuelInstance", id, pickSnapshot(jsonSafe(before)), pickSnapshot(jsonSafe(instance)), tx);
      return instance;
    });

    return NextResponse.json(jsonSafe({ ok: true, instance: updated }));
  } catch (error) {
    return apiError(error);
  }
}
