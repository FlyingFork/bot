import { NextResponse } from "next/server";
import { prisma } from "@tiles-survive/database";
import { createAuditLog } from "@/lib/audit";
import { apiError, requireAdmin } from "@/lib/server-auth";
import { pickSnapshot } from "@/lib/json";

type Params = { params: Promise<{ id: string; sessionId: string }> };

export async function POST(_request: Request, context: Params) {
  try {
    const actor = await requireAdmin();
    const { id, sessionId } = await context.params;
    const session = await prisma.session.findFirst({ where: { id: sessionId, userId: id } });
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    await prisma.session.delete({ where: { id: session.id } });
    await createAuditLog(
      actor.id,
      "USER_SESSION_REVOKED",
      "user",
      id,
      pickSnapshot({ id, sessionId: session.id, expiresAt: session.expiresAt }),
      pickSnapshot({ id, sessionId: session.id, revoked: true }),
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
