import { NextResponse } from "next/server";
import { prisma } from "@tiles-survive/database";
import { createAuditLog } from "@/lib/audit";
import { apiError, requireMinRole } from "@/lib/server-auth";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: Params) {
  try {
    const actor = await requireMinRole("r4");
    const { id: planId } = await context.params;

    const plan = await prisma.reservoirRaidPlan.findUnique({
      where: { id: planId },
      select: { id: true, startsAt: true },
    });
    if (!plan) return NextResponse.json({ errorCode: "notFound" }, { status: 404 });

    const isLocked = Date.now() >= plan.startsAt.getTime();
    if (isLocked && actor.role !== "admin") {
      return NextResponse.json({ errorCode: "locked" }, { status: 403 });
    }

    const result = await prisma.reservoirRaidAssignment.deleteMany({ where: { planId } });

    await createAuditLog(actor.id, "RAID_ASSIGNMENTS_RESET", "ReservoirRaidPlan", planId, undefined, {
      deleted: result.count,
    });

    return NextResponse.json({ ok: true, deleted: result.count });
  } catch (error) {
    return apiError(error);
  }
}
