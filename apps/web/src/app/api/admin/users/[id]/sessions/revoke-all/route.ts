import { NextResponse } from "next/server";
import { prisma } from "@tiles-survive/database";
import { createAuditLog } from "@/lib/audit";
import { apiError, requireAdmin } from "@/lib/server-auth";
import { pickSnapshot } from "@/lib/json";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Params) {
  try {
    const actor = await requireAdmin();
    const { id } = await context.params;
    if (actor.id === id) return NextResponse.json({ error: "You cannot revoke all of your own sessions" }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const deleted = await prisma.session.deleteMany({ where: { userId: id } });
    await createAuditLog(
      actor.id,
      "USER_SESSIONS_REVOKED",
      "user",
      id,
      pickSnapshot({ id, sessionCount: deleted.count }),
      pickSnapshot({ id, sessionCount: 0 }),
    );

    return NextResponse.json({ ok: true, revoked: deleted.count });
  } catch (error) {
    return apiError(error);
  }
}
