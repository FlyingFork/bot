import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@tiles-survive/database";
import { createAuditLog } from "@/lib/audit";
import { jsonSafe, pickSnapshot } from "@/lib/json";
import { notifyR4Plus } from "@/lib/notifications";
import { apiError, requireAdmin } from "@/lib/server-auth";
import { combineUtcDateTime, dateInputToUtcMidnight, isSundayUtc } from "@/lib/phase6";
import { OBJECTIVE_DEFINITIONS } from "@/lib/raid-objectives";

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAdmin();
    const body = (await request.json()) as { raidDate?: string; utcTime?: string };

    const raidDate = dateInputToUtcMidnight(body.raidDate);
    if (!raidDate || !isSundayUtc(raidDate)) {
      return NextResponse.json({ errorCode: "sundayRequired" }, { status: 400 });
    }

    const timeValue = typeof body.utcTime === "string" ? body.utcTime : "";
    const dateValue = typeof body.raidDate === "string" ? body.raidDate : "";
    const startsAt = combineUtcDateTime(dateValue, timeValue);
    if (!startsAt) {
      return NextResponse.json({ errorCode: "invalidTime" }, { status: 400 });
    }

    const plan = await prisma.$transaction(async (tx) => {
      const created = await tx.reservoirRaidPlan.create({
        data: {
          raidDate,
          startsAt,
          publicToken: crypto.randomUUID(),
          registrationOpen: true,
          status: "ACTIVE",
          createdById: actor.id,
        },
      });
      await tx.reservoirRaidObjective.createMany({
        data: OBJECTIVE_DEFINITIONS.map((def) => ({
          planId: created.id,
          key: def.key,
          tier: def.tier,
          waterRate: def.waterRate,
          isAssignable: def.isAssignable,
          mapX: def.mapX,
          mapY: def.mapY,
        })),
      });
      return created;
    });

    await createAuditLog(actor.id, "RAID_PLAN_CREATED", "ReservoirRaidPlan", plan.id, undefined, pickSnapshot(jsonSafe(plan)));
    await notifyR4Plus(
      "EVENT_CREATED",
      "eventCreated",
      { eventName: `Reservoir Raid ${raidDate.toISOString().slice(0, 10)}` },
      { reservoirRaidPlanId: plan.id },
    );

    return NextResponse.json(jsonSafe({ ok: true, plan }));
  } catch (error) {
    return apiError(error);
  }
}
