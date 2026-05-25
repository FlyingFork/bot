import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@tiles-survive/database";
import { createAuditLog } from "@/lib/audit";
import { apiError, requireAdmin } from "@/lib/server-auth";
import { dateInputToUtc } from "@/lib/phase4-shared";
import { jsonSafe, pickSnapshot } from "@/lib/json";

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAdmin();
    const body = (await request.json()) as { name?: string; startDate?: string };
    const name = body.name?.trim();
    const startDate = dateInputToUtc(body.startDate);
    if (!name || !startDate) return NextResponse.json({ error: "Invalid season" }, { status: 400 });

    const active = await prisma.season.findFirst({ where: { isActive: true }, select: { id: true } });
    if (active) return NextResponse.json({ error: "Active season exists" }, { status: 409 });

    const season = await prisma.season.create({ data: { name, startDate, isActive: true } });
    await createAuditLog(actor.id, "SEASON_CREATED", "Season", season.id, undefined, pickSnapshot(jsonSafe(season)));
    return NextResponse.json(jsonSafe({ ok: true, season }));
  } catch (error) {
    return apiError(error);
  }
}
