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
    const member = await prisma.allianceMember.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });
    if (!member.user) return NextResponse.json({ error: "No linked account" }, { status: 400 });

    const before = member.user;
    const after = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: before.id },
        data: { platformStatus: "ACTIVE", emailVerified: true },
      });
      await createAuditLog(
        actor.id,
        "ACCOUNT_UNSUSPENDED",
        "user",
        before.id,
        pickSnapshot(before),
        pickSnapshot(updated),
        tx,
      );
      return updated;
    });

    return NextResponse.json(jsonSafe({ ok: true, user: after }));
  } catch (error) {
    return apiError(error);
  }
}

