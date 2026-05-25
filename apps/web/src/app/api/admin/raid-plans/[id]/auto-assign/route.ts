import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@tiles-survive/database";
import { createAuditLog } from "@/lib/audit";
import { apiError, requireMinRole } from "@/lib/server-auth";

type Params = { params: Promise<{ id: string }> };
type AssignmentConfig = { objectiveId: string; count: number };

export async function POST(request: NextRequest, context: Params) {
  try {
    const actor = await requireMinRole("r4");
    const { id: planId } = await context.params;
    const body = (await request.json()) as { assignments?: AssignmentConfig[] };

    if (!Array.isArray(body.assignments) || body.assignments.length === 0) {
      return NextResponse.json({ errorCode: "assignmentsRequired" }, { status: 400 });
    }

    const plan = await prisma.reservoirRaidPlan.findUnique({
      where: { id: planId },
      select: { id: true, startsAt: true },
    });
    if (!plan) return NextResponse.json({ errorCode: "notFound" }, { status: 404 });

    const isLocked = Date.now() >= plan.startsAt.getTime();
    if (isLocked && actor.role !== "admin") {
      return NextResponse.json({ errorCode: "locked" }, { status: 403 });
    }

    const participants = await prisma.reservoirRaidParticipant.findMany({
      where: {
        planId,
        registrationStatus: { in: ["SELECTED_PARTICIPANT", "SELECTED_RESERVIST"] },
      },
      include: { squadPowers: { where: { squadIndex: 1 } } },
    });

    // Sort: participants first then reservists, each group by squad1Power desc
    const getSquad1Power = (p: (typeof participants)[number]) => Number(p.squadPowers[0]?.power ?? 0);
    const mainParticipants = participants
      .filter((p) => p.registrationStatus === "SELECTED_PARTICIPANT")
      .sort((a, b) => getSquad1Power(b) - getSquad1Power(a));
    const reservists = participants
      .filter((p) => p.registrationStatus === "SELECTED_RESERVIST")
      .sort((a, b) => getSquad1Power(b) - getSquad1Power(a));
    const pool = [...mainParticipants, ...reservists];

    let cursor = 0;
    const toCreate: { planId: string; objectiveId: string; participantId: string }[] = [];

    for (const { objectiveId, count } of body.assignments) {
      const slice = pool.slice(cursor, cursor + count);
      cursor += count;
      for (const p of slice) {
        toCreate.push({ planId, objectiveId, participantId: p.id });
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      await tx.reservoirRaidAssignment.deleteMany({ where: { planId } });
      await tx.reservoirRaidAssignment.createMany({ data: toCreate });
      return toCreate.length;
    });

    await createAuditLog(actor.id, "RAID_AUTO_ASSIGNED", "ReservoirRaidPlan", planId, undefined, { created });

    return NextResponse.json({ ok: true, created });
  } catch (error) {
    return apiError(error);
  }
}
