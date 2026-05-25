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
    const body = (await request.json()) as { userId?: string };

    if (!body.userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const member = await prisma.allianceMember.findUnique({
      where: { id },
      include: { user: { select: { id: true } } },
    });
    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    const user = await prisma.user.findUnique({
      where: { id: body.userId },
      select: { id: true, allianceMemberId: true, platformStatus: true },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (user.allianceMemberId && user.allianceMemberId !== id) {
      return NextResponse.json({ error: "User is already linked to another member" }, { status: 409 });
    }

    const before = await prisma.allianceMember.findUnique({
      where: { id },
      include: { user: { select: { id: true, username: true } } },
    });

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: body.userId },
        data: { allianceMemberId: id },
      });

      await createAuditLog(
        actor.id,
        "MEMBER_USER_ASSIGNED",
        "AllianceMember",
        id,
        pickSnapshot(before),
        pickSnapshot({ ...before, linkedUserId: body.userId }),
        tx,
      );
    });

    return NextResponse.json(jsonSafe({ ok: true }));
  } catch (error) {
    return apiError(error);
  }
}
