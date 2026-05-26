import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@tiles-survive/database";
import { createAuditLog } from "@/lib/audit";
import { apiError, requireAdmin } from "@/lib/server-auth";
import { jsonSafe, pickSnapshot } from "@/lib/json";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Params) {
  try {
    const actor = await requireAdmin();
    const { id } = await context.params;
    if (actor.id === id) return NextResponse.json({ error: "You cannot ban yourself" }, { status: 400 });

    const body = (await request.json()) as { banReason?: string; banExpiresAt?: string | null };
    const before = await prisma.user.findUnique({ where: { id } });
    if (!before) return NextResponse.json({ error: "User not found" }, { status: 404 });

    let banExpires: Date | null = null;
    if (body.banExpiresAt) {
      banExpires = new Date(`${body.banExpiresAt}T23:59:59.999Z`);
      if (Number.isNaN(banExpires.getTime())) {
        return NextResponse.json({ error: "Invalid ban expiry date" }, { status: 400 });
      }
    }

    const after = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: {
          banned: true,
          banReason: body.banReason?.trim() || null,
          banExpires,
          platformStatus: "SUSPENDED",
          emailVerified: false,
        },
      });
      await tx.session.deleteMany({ where: { userId: id } });
      await createAuditLog(actor.id, "USER_BANNED", "user", id, pickSnapshot(before), pickSnapshot(updated), tx);
      return updated;
    });

    return NextResponse.json(jsonSafe({ ok: true, user: after }));
  } catch (error) {
    return apiError(error);
  }
}
