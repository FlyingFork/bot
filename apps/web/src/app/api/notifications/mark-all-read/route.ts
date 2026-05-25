import { NextResponse } from "next/server";
import { prisma } from "@tiles-survive/database";
import { apiError, requireUser } from "@/lib/server-auth";

export async function POST() {
  try {
    const user = await requireUser();
    await prisma.notification.updateMany({
      where: { userId: user.id, dismissedAt: null, read: false },
      data: { read: true },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
