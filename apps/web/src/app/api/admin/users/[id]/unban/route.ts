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
    const before = await prisma.user.findUnique({ where: { id } });
    if (!before) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const after = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: {
          banned: false,
          banReason: null,
          banExpires: null,
          platformStatus: before.platformStatus === "SUSPENDED" ? "ACTIVE" : before.platformStatus,
          emailVerified: before.platformStatus === "SUSPENDED" ? true : before.emailVerified,
        },
      });
      await createAuditLog(actor.id, "USER_UNBANNED", "user", id, pickSnapshot(before), pickSnapshot(updated), tx);
      return updated;
    });

    return NextResponse.json(jsonSafe({ ok: true, user: after }));
  } catch (error) {
    return apiError(error);
  }
}
