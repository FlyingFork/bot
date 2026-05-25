import { NextResponse } from "next/server";
import { prisma } from "@tiles-survive/database";
import { createAuditLog } from "@/lib/audit";
import { apiError, requireMinRole } from "@/lib/server-auth";

type Params = { params: Promise<{ id: string; objId: string; participantId: string }> };

export async function DELETE(_request: Request, context: Params) {
  try {
    const actor = await requireMinRole("r4");
    const { id: planId, objId, participantId } = await context.params;

    const plan = await prisma.reservoirRaidPlan.findUnique({ where: { id: planId }, select: { startsAt: true } });
    if (!plan) return NextResponse.json({ errorCode: "notFound" }, { status: 404 });

    const isLocked = Date.now() >= plan.startsAt.getTime();
    if (isLocked && actor.role !== "admin") {
      return NextResponse.json({ errorCode: "locked" }, { status: 403 });
    }

    const assignment = await prisma.reservoirRaidAssignment.findFirst({
      where: { planId, objectiveId: objId, participantId },
    });
    if (!assignment) return NextResponse.json({ errorCode: "notFound" }, { status: 404 });

    await prisma.reservoirRaidAssignment.delete({ where: { id: assignment.id } });
    await createAuditLog(actor.id, "RAID_PARTICIPANT_UNASSIGNED", "ReservoirRaidAssignment", assignment.id, { planId, objectiveId: objId, participantId });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
