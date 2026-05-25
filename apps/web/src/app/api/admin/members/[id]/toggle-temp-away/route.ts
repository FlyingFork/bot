import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@tiles-survive/database";
import { createAuditLog } from "@/lib/audit";
import { apiError, requireMinRole } from "@/lib/server-auth";
import { jsonSafe, pickSnapshot } from "@/lib/json";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Params) {
  try {
    const actor = await requireMinRole("r4");
    const { id } = await context.params;
    const body = (await request.json()) as {
      enabled?: boolean;
      tempAwayAllianceTag?: string;
    };

    const before = await prisma.allianceMember.findUnique({ where: { id } });
    if (!before) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    const enabled = Boolean(body.enabled);
    const tag = body.tempAwayAllianceTag?.trim();
    if (enabled && !tag) {
      return NextResponse.json({ error: "Alliance tag is required" }, { status: 400 });
    }

    const member = await prisma.$transaction(async (tx) => {
      const after = await tx.allianceMember.update({
        where: { id },
        data: enabled
          ? {
              isTempAway: true,
              tempAwayAllianceTag: tag,
              memberStatus: "TEMP_AWAY",
              active: true,
              leftAt: null,
            }
          : {
              isTempAway: false,
              tempAwayAllianceTag: null,
              memberStatus: "ACTIVE",
              active: true,
            },
      });

      await createAuditLog(
        actor.id,
        "TEMP_AWAY_TOGGLED",
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

