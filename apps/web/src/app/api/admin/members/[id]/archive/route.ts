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
    const before = await prisma.allianceMember.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!before) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    const member = await prisma.$transaction(async (tx) => {
      const archived = await tx.allianceMember.update({
        where: { id },
        data: {
          memberStatus: "LEFT",
          active: false,
          leftAt: new Date(),
          isTempAway: false,
          tempAwayAllianceTag: null,
        },
      });

      if (before.user) {
        await tx.user.update({
          where: { id: before.user.id },
          data: { platformStatus: "SUSPENDED", emailVerified: false },
        });
      }

      await createAuditLog(
        actor.id,
        "MEMBER_ARCHIVED",
        "AllianceMember",
        id,
        pickSnapshot(before),
        pickSnapshot(archived),
        tx,
      );

      return archived;
    });

    return NextResponse.json(jsonSafe({ ok: true, member }));
  } catch (error) {
    return apiError(error);
  }
}

