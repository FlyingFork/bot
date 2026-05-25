import { NextResponse } from "next/server";
import { prisma } from "@tiles-survive/database";
import { apiError, requireUser } from "@/lib/server-auth";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Params) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    await prisma.notification.updateMany({
      where: { id, userId: user.id },
      data: { dismissedAt: new Date(), read: true },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
