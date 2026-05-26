import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@tiles-survive/database";
import { apiError, requireAdmin } from "@/lib/server-auth";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const available = searchParams.get("available") === "true";
    const q = searchParams.get("q")?.trim();

    const users = await prisma.user.findMany({
      where: {
        ...(available ? { platformStatus: "ACTIVE" } : {}),
        ...(available ? { allianceMemberId: null } : {}),
        ...(!available && q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { username: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        email: !available,
        username: true,
        platformStatus: true,
        role: true,
        banned: !available,
        lastSeenAt: !available,
        allianceMemberId: !available,
      },
      orderBy: available ? { name: "asc" } : { lastSeenAt: "desc" },
      take: available ? undefined : 50,
    });

    return NextResponse.json({ users });
  } catch (error) {
    return apiError(error);
  }
}
