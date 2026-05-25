import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@tiles-survive/database";
import { createAuditLog } from "@/lib/audit";
import { jsonSafe, pickSnapshot } from "@/lib/json";
import { apiError, requireAdmin } from "@/lib/server-auth";
import { combineUtcDateTime, dateInputToUtcMidnight, isSundayUtc } from "@/lib/phase6";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Params) {
  try {
    const actor = await requireAdmin();
    const { id } = await context.params;
    const body = (await request.json()) as {
      raidDate?: string;
      utcTime?: string;
      status?: string;
      registrationOpen?: boolean;
    };

    const plan = await prisma.reservoirRaidPlan.findUnique({ where: { id } });
    if (!plan) return NextResponse.json({ errorCode: "notFound" }, { status: 404 });

    const raidDate = body.raidDate ? dateInputToUtcMidnight(body.raidDate) : plan.raidDate;
    if (!raidDate) return NextResponse.json({ errorCode: "sundayRequired" }, { status: 400 });
    if (body.raidDate && !isSundayUtc(raidDate)) {
      return NextResponse.json({ errorCode: "sundayRequired" }, { status: 400 });
    }

    const dateValue = body.raidDate ?? plan.raidDate.toISOString().slice(0, 10);
    const timeValue = body.utcTime ?? plan.startsAt.toISOString().slice(11, 16);
    const startsAt = combineUtcDateTime(dateValue, timeValue);
    if (!startsAt) return NextResponse.json({ errorCode: "invalidTime" }, { status: 400 });

    const validStatuses = ["ACTIVE", "ENDED"];
    const status = body.status && validStatuses.includes(body.status) ? body.status : plan.status;

    const updated = await prisma.reservoirRaidPlan.update({
      where: { id },
      data: {
        raidDate,
        startsAt,
        status: status as "ACTIVE" | "ENDED",
        registrationOpen: typeof body.registrationOpen === "boolean" ? body.registrationOpen : plan.registrationOpen,
      },
    });

    await createAuditLog(actor.id, "RAID_PLAN_UPDATED", "ReservoirRaidPlan", id, pickSnapshot(jsonSafe(plan)), pickSnapshot(jsonSafe(updated)));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
