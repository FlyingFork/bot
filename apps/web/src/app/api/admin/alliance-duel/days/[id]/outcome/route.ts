import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@tiles-survive/database";
import { createAuditLog } from "@/lib/audit";
import { apiError, requireAdmin } from "@/lib/server-auth";
import { normalizeOutcome } from "@/lib/phase5";
import { jsonSafe, pickSnapshot } from "@/lib/json";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Params) {
  try {
    const actor = await requireAdmin();
    const { id } = await context.params;
    const body = (await request.json()) as { outcome?: string | null };
    const dayOutcome = body.outcome ? normalizeOutcome(body.outcome) : null;
    if (body.outcome && !dayOutcome) return NextResponse.json({ errorCode: "invalidOutcome" }, { status: 400 });

    const before = await prisma.allianceDuelDay.findUnique({ where: { id } });
    if (!before) return NextResponse.json({ errorCode: "notFound" }, { status: 404 });
    const updated = await prisma.allianceDuelDay.update({ where: { id }, data: { dayOutcome } });
    await createAuditLog(actor.id, "DUEL_DAY_OUTCOME_UPDATED", "AllianceDuelDay", id, pickSnapshot(jsonSafe(before)), pickSnapshot(jsonSafe(updated)));
    return NextResponse.json(jsonSafe({ ok: true, day: updated }));
  } catch (error) {
    return apiError(error);
  }
}
