import { NextResponse } from "next/server";
import { prisma } from "@tiles-survive/database";
import { createAuditLog } from "@/lib/audit";
import { apiError, requireAdmin } from "@/lib/server-auth";
import { jsonSafe, pickSnapshot } from "@/lib/json";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Params) {
  try {
    const actor = await requireAdmin();
    const { id } = await context.params;
    const before = await prisma.allianceDuelInstance.findUnique({ where: { id }, include: { days: true } });
    if (!before) return NextResponse.json({ errorCode: "notFound" }, { status: 404 });
    if (before.days.some((day) => day.hasData)) {
      return NextResponse.json({ errorCode: "hasData" }, { status: 409 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.allianceDuelInstance.delete({ where: { id } });
      await createAuditLog(actor.id, "DUEL_INSTANCE_DELETED", "AllianceDuelInstance", id, pickSnapshot(jsonSafe(before)), undefined, tx);
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
