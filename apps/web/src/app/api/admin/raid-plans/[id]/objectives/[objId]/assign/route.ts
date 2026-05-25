import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@tiles-survive/database";
import { createAuditLog } from "@/lib/audit";
import { apiError, requireMinRole } from "@/lib/server-auth";

type Params = { params: Promise<{ id: string; objId: string }> };

export async function POST(request: NextRequest, context: Params) {
  try {
    const actor = await requireMinRole("r4");
    const { id: planId, objId } = await context.params;
    const body = (await request.json()) as { participantId?: string };

    if (!body.participantId) return NextResponse.json({ errorCode: "participantRequired" }, { status: 400 });

    const [plan, objective, participant] = await Promise.all([
      prisma.reservoirRaidPlan.findUnique({ where: { id: planId }, select: { startsAt: true } }),
      prisma.reservoirRaidObjective.findFirst({ where: { id: objId, planId } }),
      prisma.reservoirRaidParticipant.findFirst({ where: { id: body.participantId, planId } }),
    ]);

    if (!plan) return NextResponse.json({ errorCode: "notFound" }, { status: 404 });
    if (!objective) return NextResponse.json({ errorCode: "objectiveNotFound" }, { status: 404 });
    if (!participant) return NextResponse.json({ errorCode: "participantNotFound" }, { status: 404 });

    const isLocked = Date.now() >= plan.startsAt.getTime();
    if (isLocked && actor.role !== "admin") {
      return NextResponse.json({ errorCode: "locked" }, { status: 403 });
    }

    await prisma.reservoirRaidAssignment.upsert({
      where: { participantId: body.participantId },
      create: { planId, objectiveId: objId, participantId: body.participantId },
      update: { objectiveId: objId },
    });

    await createAuditLog(actor.id, "RAID_PARTICIPANT_ASSIGNED", "ReservoirRaidAssignment", objId, undefined, {
      planId,
      objectiveId: objId,
      participantId: body.participantId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
