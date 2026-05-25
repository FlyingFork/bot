import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@tiles-survive/database";
import { createAuditLog } from "@/lib/audit";
import { apiError, requireAdmin } from "@/lib/server-auth";
import { pickSnapshot } from "@/lib/json";

const ROLES = ["r1", "r2", "r3", "r4", "r5"] as const;
const VERIFIED_COPY = {
  en: {
    title: "Account verified",
    message: "Your account has been verified and activated.",
  },
  ru: {
    title: "Аккаунт проверен",
    message: "Ваш аккаунт проверен и активирован.",
  },
  tr: {
    title: "Hesap doğrulandı",
    message: "Hesabınız doğrulandı ve etkinleştirildi.",
  },
} as const;

type Params = { params: Promise<{ userId: string }> };

export async function POST(request: NextRequest, context: Params) {
  try {
    const actor = await requireAdmin();
    const { userId } = await context.params;
    const body = (await request.json()) as {
      allianceMemberId?: string;
      role?: string;
    };

    if (!body.allianceMemberId) {
      return NextResponse.json({ error: "Alliance member is required" }, { status: 400 });
    }

    const before = await prisma.user.findUnique({
      where: { id: userId },
      include: { allianceMember: { select: { id: true, username: true } } },
    });

    if (!before) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (before.platformStatus !== "PENDING") {
      return NextResponse.json({ error: "User is not pending" }, { status: 400 });
    }

    const assignedRole = before.role === "admin" ? "admin" : body.role;
    if (assignedRole !== "admin" && !ROLES.includes(assignedRole as (typeof ROLES)[number])) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const member = await prisma.allianceMember.findUnique({
      where: { id: body.allianceMemberId },
      select: { id: true },
    });
    if (!member) return NextResponse.json({ error: "Alliance member not found" }, { status: 404 });

    const copy = VERIFIED_COPY[before.language as keyof typeof VERIFIED_COPY] ?? VERIFIED_COPY.en;

    const updated = await prisma.$transaction(async (tx) => {
      const after = await tx.user.update({
        where: { id: userId },
        data: {
          platformStatus: "ACTIVE",
          emailVerified: true,
          role: assignedRole,
          allianceMemberId: body.allianceMemberId,
        },
      });

      await tx.notification.create({
        data: {
          userId,
          type: "ACCOUNT_VERIFIED",
          title: copy.title,
          message: copy.message,
          data: { role: assignedRole, allianceMemberId: body.allianceMemberId },
        },
      });

      await createAuditLog(
        actor.id,
        "USER_VERIFIED",
        "user",
        userId,
        pickSnapshot(before),
        pickSnapshot(after),
        tx,
      );

      return after;
    });

    return NextResponse.json({ ok: true, user: { id: updated.id } });
  } catch (error) {
    return apiError(error);
  }
}
