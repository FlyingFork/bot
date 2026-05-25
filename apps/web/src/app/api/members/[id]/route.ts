import { NextResponse } from "next/server";
import { prisma } from "@tiles-survive/database";
import { apiError, requireUser } from "@/lib/server-auth";
import { hasRole } from "@/lib/roles";
import { jsonSafe } from "@/lib/json";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Params) {
  try {
    const user = await requireUser();
    const { id } = await context.params;

    if (!hasRole(user.role, "r4") && user.allianceMemberId !== id) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const member = await prisma.allianceMember.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            role: true,
            platformStatus: true,
            banned: true,
          },
        },
        nameHistory: { orderBy: { changedAt: "desc" } },
      },
    });
    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });
    return NextResponse.json(jsonSafe({ member }));
  } catch (error) {
    return apiError(error);
  }
}
