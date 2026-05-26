import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@tiles-survive/database";
import { auth } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { apiError, requireAdmin } from "@/lib/server-auth";
import { pickSnapshot } from "@/lib/json";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Params) {
  try {
    const actor = await requireAdmin();
    const { id } = await context.params;
    const body = (await request.json()) as { newPassword?: string };

    if (!body.newPassword || body.newPassword.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    await auth.api.setUserPassword({
      headers: await headers(),
      body: { userId: id, newPassword: body.newPassword },
    });

    await createAuditLog(
      actor.id,
      "USER_PASSWORD_SET",
      "user",
      id,
      pickSnapshot({ id: user.id, passwordChanged: false }),
      pickSnapshot({ id: user.id, passwordChanged: true }),
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
