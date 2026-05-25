import { NextResponse } from "next/server";
import { prisma } from "@tiles-survive/database";
import { createAuditLog } from "@/lib/audit";
import { jsonSafe, pickSnapshot } from "@/lib/json";
import { apiError, requireAdmin } from "@/lib/server-auth";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(_request: Request, context: Params) {
  try {
    const actor = await requireAdmin();
    const { id } = await context.params;

    const plan = await prisma.reservoirRaidPlan.findUnique({ where: { id } });
    if (!plan) return NextResponse.json({ errorCode: "notFound" }, { status: 404 });

    const updated = await prisma.reservoirRaidPlan.update({
      where: { id },
      data: { registrationOpen: !plan.registrationOpen },
    });

    await createAuditLog(
      actor.id,
      "RAID_REGISTRATION_TOGGLED",
      "ReservoirRaidPlan",
      id,
      pickSnapshot(jsonSafe(plan)),
      pickSnapshot(jsonSafe(updated)),
    );
    return NextResponse.json({ ok: true, registrationOpen: updated.registrationOpen });
  } catch (error) {
    return apiError(error);
  }
}
