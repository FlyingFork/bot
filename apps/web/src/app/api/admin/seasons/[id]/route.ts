import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@tiles-survive/database";
import { createAuditLog } from "@/lib/audit";
import { apiError, requireAdmin } from "@/lib/server-auth";
import { dateInputToUtc } from "@/lib/phase4-shared";
import { jsonSafe, pickSnapshot } from "@/lib/json";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Params) {
  try {
    const actor = await requireAdmin();
    const { id } = await context.params;
    const body = (await request.json()) as {
      startDate?: string | null;
      endDate?: string | null;
    };

    const startDate = dateInputToUtc(body.startDate);
    const endDate = body.endDate ? dateInputToUtc(body.endDate) : null;

    if (!startDate) return NextResponse.json({ error: "Invalid start date" }, { status: 400 });
    if (body.endDate && !endDate) return NextResponse.json({ error: "Invalid end date" }, { status: 400 });
    if (endDate && endDate.getTime() < startDate.getTime()) {
      return NextResponse.json({ error: "End date must be on or after the start date" }, { status: 400 });
    }

    const before = await prisma.season.findUnique({ where: { id } });
    if (!before) return NextResponse.json({ error: "Season not found" }, { status: 404 });

    const season = await prisma.season.update({
      where: { id },
      data: { startDate, endDate },
    });

    await createAuditLog(
      actor.id,
      "SEASON_DATES_EDITED",
      "Season",
      id,
      pickSnapshot(before),
      pickSnapshot(jsonSafe(season)),
    );

    return NextResponse.json(jsonSafe({ ok: true, season }));
  } catch (error) {
    return apiError(error);
  }
}
