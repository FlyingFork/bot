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
    const outcome = body.outcome ? normalizeOutcome(body.outcome) : null;
    if (body.outcome && !outcome) return NextResponse.json({ errorCode: "invalidOutcome" }, { status: 400 });

    const before = await prisma.allianceDuelInstance.findUnique({ where: { id } });
    if (!before) return NextResponse.json({ errorCode: "notFound" }, { status: 404 });
    const updated = await prisma.allianceDuelInstance.update({ where: { id }, data: { outcome } });
    await createAuditLog(actor.id, "DUEL_OUTCOME_UPDATED", "AllianceDuelInstance", id, pickSnapshot(jsonSafe(before)), pickSnapshot(jsonSafe(updated)));
    return NextResponse.json(jsonSafe({ ok: true, instance: updated }));
  } catch (error) {
    return apiError(error);
  }
}
