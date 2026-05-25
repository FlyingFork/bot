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
      include: { user: { select: { id: true, username: true } } },
    });
    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });
    if (!member.user) return NextResponse.json({ error: "Member has no linked user" }, { status: 400 });

    const before = { ...member };

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: member.user!.id },
        data: { allianceMemberId: null },
      });

      await createAuditLog(
        actor.id,
        "MEMBER_USER_UNASSIGNED",
        "AllianceMember",
        id,
        pickSnapshot(before),
        pickSnapshot({ ...before, user: null }),
        tx,
      );
    });

    return NextResponse.json(jsonSafe({ ok: true }));
  } catch (error) {
    return apiError(error);
  }
}
