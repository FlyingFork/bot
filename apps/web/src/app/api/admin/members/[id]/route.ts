import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@tiles-survive/database";
import { createAuditLog } from "@/lib/audit";
import { apiError, requireAdmin } from "@/lib/server-auth";
import { jsonSafe, pickSnapshot } from "@/lib/json";

const RANKS = ["R1", "R2", "R3", "R4", "R5"] as const;

type Params = { params: Promise<{ id: string }> };

function parseJoinedAt(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new Error("Invalid joined date");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid joined date");
  return date;
}

export async function PATCH(request: NextRequest, context: Params) {
  try {
    const actor = await requireAdmin();
    const { id } = await context.params;
    const body = (await request.json()) as {
      username?: string;
      currentRank?: string | null;
      joinedAt?: string | null;
      isTempAway?: boolean;
      tempAwayAllianceTag?: string | null;
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

    const before = await prisma.allianceMember.findUnique({ where: { id } });
    if (!before) return NextResponse.json({ error: "Member not found" }, { status: 404 });
    const isTempAway = Boolean(body.isTempAway);
    const tempAwayAllianceTag = body.tempAwayAllianceTag?.trim() || null;
    if (isTempAway && !tempAwayAllianceTag) {
      return NextResponse.json({ error: "Temporary alliance tag is required" }, { status: 400 });
    }

    const member = await prisma.$transaction(async (tx) => {
      if (before.username !== username) {
        await tx.memberNameHistory.create({
          data: { memberId: id, name: before.username },
        });
      }

      const after = await tx.allianceMember.update({
        where: { id },
        data: {
          username,
          currentRank: (body.currentRank || null) as (typeof RANKS)[number] | null,
          joinedAt,
          isTempAway,
          tempAwayAllianceTag: isTempAway ? tempAwayAllianceTag : null,
          memberStatus: isTempAway ? "TEMP_AWAY" : before.memberStatus === "TEMP_AWAY" ? "ACTIVE" : before.memberStatus,
          active: before.memberStatus === "LEFT" ? before.active : true,
        },
      });

      if (before.username !== username) {
        await tx.allianceDuelScore.updateMany({
          where: { memberId: id, side: "ALLY" },
          data: { playerName: username },
        });

        const raidParticipants = await tx.reservoirRaidParticipant.findMany({
          where: { memberId: id, username: { not: username } },
          select: { id: true, planId: true },
        });
        for (const participant of raidParticipants) {
          const conflict = await tx.reservoirRaidParticipant.findFirst({
            where: {
              planId: participant.planId,
              username,
              id: { not: participant.id },
            },
            select: { id: true },
          });
          if (!conflict) {
            await tx.reservoirRaidParticipant.update({
              where: { id: participant.id },
              data: { username },
            });
          }
        }
      }

      await createAuditLog(
        actor.id,
        "MEMBER_EDITED",
        "AllianceMember",
        id,
        pickSnapshot(before),
        pickSnapshot(after),
        tx,
      );

      return after;
    });

    return NextResponse.json(jsonSafe({ ok: true, member }));
  } catch (error) {
    return apiError(error);
  }
}
