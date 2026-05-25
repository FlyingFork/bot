import { NextResponse } from "next/server";
import { prisma } from "@tiles-survive/database";
import { apiError, requireAdmin } from "@/lib/server-auth";
import { jsonSafe } from "@/lib/json";

export async function GET() {
  try {
    await requireAdmin();
    const users = await prisma.user.findMany({
      where: { platformStatus: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });
    return NextResponse.json(jsonSafe({ users }));
  } catch (error) {
    return apiError(error);
  }
}

