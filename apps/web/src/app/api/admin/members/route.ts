import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@tiles-survive/database";
import { createAuditLog } from "@/lib/audit";
import { apiError, requireAdmin } from "@/lib/server-auth";
import { jsonSafe, pickSnapshot } from "@/lib/json";

const RANKS = ["R1", "R2", "R3", "R4", "R5"] as const;

function parseJoinedAt(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new Error("Invalid joined date");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid joined date");
  return date;
}

export async function GET() {
  try {
    await requireAdmin();
    const members = await prisma.allianceMember.findMany({
      orderBy: { username: "asc" },
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
      },
    });
    return NextResponse.json(jsonSafe({ members }));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAdmin();
    const body = (await request.json()) as {
      username?: string;
      currentRank?: string;
      joinedAt?: string | null;
    };

    const username = body.username?.trim();
    if (!username) return NextResponse.json({ error: "In-game name is required" }, { status: 400 });
    if (body.currentRank && !RANKS.includes(body.currentRank as (typeof RANKS)[number])) {
      return NextResponse.json({ error: "Invalid rank" }, { status: 400 });
    }

    let joinedAt: Date | null;
    try {
      joinedAt = parseJoinedAt(body.joinedAt);
    } catch {
      return NextResponse.json({ error: "Invalid joined date" }, { status: 400 });
    }

    const member = await prisma.$transaction(async (tx) => {
      const created = await tx.allianceMember.create({
        data: {
          username,
          currentRank: body.currentRank as (typeof RANKS)[number] | undefined,
          joinedAt,
          memberStatus: "ACTIVE",
          active: true,
        },
      });
      await createAuditLog(
        actor.id,
        "MEMBER_CREATED",
        "AllianceMember",
        created.id,
        undefined,
        pickSnapshot(created),
        tx,
      );
      return created;
    });

    return NextResponse.json(jsonSafe({ ok: true, member }));
  } catch (error) {
    return apiError(error);
  }
}

