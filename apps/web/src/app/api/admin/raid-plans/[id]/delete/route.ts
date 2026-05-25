import { NextResponse } from "next/server";
import { prisma } from "@tiles-survive/database";
import { createAuditLog } from "@/lib/audit";
import { jsonSafe, pickSnapshot } from "@/lib/json";
import { apiError, requireAdmin } from "@/lib/server-auth";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Params) {
  try {
    const actor = await requireAdmin();
    const { id } = await context.params;

    const plan = await prisma.reservoirRaidPlan.findUnique({
      where: { id },
      include: { _count: { select: { participants: true } } },
    });
    if (!plan) return NextResponse.json({ errorCode: "notFound" }, { status: 404 });
    if (plan._count.participants > 0) {
      return NextResponse.json({ errorCode: "hasParticipants" }, { status: 400 });
    }

    await prisma.reservoirRaidPlan.delete({ where: { id } });
    await createAuditLog(actor.id, "RAID_PLAN_DELETED", "ReservoirRaidPlan", id, pickSnapshot(jsonSafe(plan)));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
