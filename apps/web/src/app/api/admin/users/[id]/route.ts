import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@tiles-survive/database";
import { createAuditLog } from "@/lib/audit";
import { apiError, requireAdmin } from "@/lib/server-auth";
import { jsonSafe, pickSnapshot } from "@/lib/json";

const ROLES = ["admin", "r5", "r4", "r3", "r2", "r1"] as const;
const STATUSES = ["PENDING", "ACTIVE", "SUSPENDED"] as const;
const LANGUAGES = ["en", "ru", "tr"] as const;

type Params = { params: Promise<{ id: string }> };

function uniqueError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function PATCH(request: NextRequest, context: Params) {
  try {
    const actor = await requireAdmin();
    const { id } = await context.params;
    const body = (await request.json()) as {
      name?: string;
      username?: string;
      email?: string;
      language?: string;
      role?: string;
      platformStatus?: string;
      allianceMemberId?: string | null;
    };

    const before = await prisma.user.findUnique({
      where: { id },
      include: { allianceMember: { select: { id: true, username: true } } },
    });
    if (!before) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const name = body.name?.trim();
    const username = body.username?.trim();
    const email = body.email?.trim().toLowerCase();
    const role = body.role?.trim();
    const platformStatus = body.platformStatus?.trim();
    const language = body.language?.trim();
    const allianceMemberId = body.allianceMemberId?.trim() || null;

    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!username) return NextResponse.json({ error: "Username is required" }, { status: 400 });
    if (!email || !email.includes("@")) return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    if (!role || !ROLES.includes(role as (typeof ROLES)[number])) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    if (!platformStatus || !STATUSES.includes(platformStatus as (typeof STATUSES)[number])) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    if (!language || !LANGUAGES.includes(language as (typeof LANGUAGES)[number])) {
      return NextResponse.json({ error: "Invalid language" }, { status: 400 });
    }

    if (actor.id === id && (role !== "admin" || platformStatus !== "ACTIVE")) {
      return NextResponse.json({ error: "You cannot demote or deactivate yourself" }, { status: 400 });
    }

    if (allianceMemberId) {
      const member = await prisma.allianceMember.findUnique({
        where: { id: allianceMemberId },
        select: { id: true, user: { select: { id: true } } },
      });
      if (!member) return NextResponse.json({ error: "Alliance member not found" }, { status: 404 });
      if (member.user && member.user.id !== id) {
        return NextResponse.json({ error: "Alliance member is already linked to another user" }, { status: 409 });
      }
    }

    try {
      const updated = await prisma.$transaction(async (tx) => {
        const after = await tx.user.update({
          where: { id },
          data: {
            name,
            username,
            email,
            language: language as (typeof LANGUAGES)[number],
            role,
            platformStatus: platformStatus as (typeof STATUSES)[number],
            emailVerified: platformStatus === "ACTIVE",
            allianceMemberId,
          },
          include: { allianceMember: { select: { id: true, username: true } } },
        });

        await createAuditLog(
          actor.id,
          "USER_UPDATED",
          "user",
          id,
          pickSnapshot(before),
          pickSnapshot(after),
          tx,
        );

        return after;
      });

      return NextResponse.json(jsonSafe({ ok: true, user: updated }));
    } catch (error) {
      if (uniqueError(error)) {
        return NextResponse.json({ error: "Email, username, or alliance member is already in use" }, { status: 409 });
      }
      throw error;
    }
  } catch (error) {
    return apiError(error);
  }
}
