import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@tiles-survive/database";
import { apiError, requireAdmin } from "@/lib/server-auth";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const available = searchParams.get("available") === "true";

    const users = await prisma.user.findMany({
      where: {
        platformStatus: "ACTIVE",
        ...(available ? { allianceMemberId: null } : {}),
      },
      select: {
        id: true,
        name: true,
        username: true,
        platformStatus: true,
        role: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ users });
  } catch (error) {
    return apiError(error);
  }
}
