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
    const before = await prisma.season.findUnique({ where: { id } });
    if (!before) return NextResponse.json({ error: "Season not found" }, { status: 404 });
    if (!before.isActive) return NextResponse.json({ error: "Season already closed" }, { status: 400 });

    const now = new Date();
    const season = await prisma.season.update({
      where: { id },
      data: { isActive: false, closedAt: now, endDate: now, closedById: actor.id },
    });
    await createAuditLog(actor.id, "SEASON_CLOSED", "Season", id, pickSnapshot(before), pickSnapshot(jsonSafe(season)));
    return NextResponse.json(jsonSafe({ ok: true, season }));
  } catch (error) {
    return apiError(error);
  }
}
