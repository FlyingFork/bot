import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@tiles-survive/database";
import { createAuditLog } from "@/lib/audit";
import { jsonSafe, pickSnapshot } from "@/lib/json";
import { apiError, requireMinRole } from "@/lib/server-auth";
import type { RegistrationStatus } from "@tiles-survive/database";

const VALID_STATUSES: RegistrationStatus[] = [
  "MATCHED",
  "SELECTED_PARTICIPANT",
  "SELECTED_RESERVIST",
  "NOT_SELECTED",
];

type Params = { params: Promise<{ id: string; regId: string }> };

export async function PATCH(request: NextRequest, context: Params) {
  try {
    const actor = await requireMinRole("r4");
    const { id: planId, regId } = await context.params;
    const body = (await request.json()) as {
      memberId?: string | null;
      registrationStatus?: string;
    };

    const participant = await prisma.reservoirRaidParticipant.findFirst({
      where: { id: regId, planId },
    });
    if (!participant) return NextResponse.json({ errorCode: "notFound" }, { status: 404 });

    const data: Record<string, unknown> = {};

    if (body.memberId !== undefined) {
      const member = body.memberId
        ? await prisma.allianceMember.findUnique({ where: { id: body.memberId }, select: { id: true, username: true } })
        : null;
      if (body.memberId && !member) return NextResponse.json({ errorCode: "memberNotFound" }, { status: 404 });
      if (member) {
        const existingParticipant = await prisma.reservoirRaidParticipant.findFirst({
          where: {
            planId,
            id: { not: regId },
            OR: [{ memberId: member.id }, { username: member.username }],
          },
        });

        if (existingParticipant) {
          const unmatchedPowers = await prisma.reservoirRaidSquadPower.findMany({
            where: { participantId: regId },
          });

          await prisma.$transaction(async (tx) => {
            for (const sp of unmatchedPowers) {
              await tx.reservoirRaidSquadPower.upsert({
                where: { participantId_squadIndex: { participantId: existingParticipant.id, squadIndex: sp.squadIndex } },
                create: { participantId: existingParticipant.id, memberId: member.id, squadIndex: sp.squadIndex, power: sp.power },
                update: { power: sp.power },
              });
            }
            if (!existingParticipant.contactType && participant.contactType) {
              await tx.reservoirRaidParticipant.update({
                where: { id: existingParticipant.id },
                data: { contactType: participant.contactType, contact: participant.contact },
              });
            }
            await tx.reservoirRaidParticipant.delete({ where: { id: regId } });
          });

          await createAuditLog(
            actor.id,
            "RAID_PARTICIPANT_MERGED",
            "ReservoirRaidParticipant",
            regId,
            pickSnapshot(jsonSafe(participant)),
            pickSnapshot(jsonSafe(existingParticipant)),
          );

          return NextResponse.json({ ok: true });
        }

        data.username = member.username;
      }
      data.memberId = body.memberId ?? null;
      data.registrationStatus = body.memberId ? "MATCHED" : "UNMATCHED";
    }

    if (body.registrationStatus !== undefined) {
      if (!VALID_STATUSES.includes(body.registrationStatus as RegistrationStatus)) {
        return NextResponse.json({ errorCode: "invalidStatus" }, { status: 400 });
      }
      data.registrationStatus = body.registrationStatus;
    }

    const updated = await prisma.reservoirRaidParticipant.update({
      where: { id: regId },
      data,
    });

    await createAuditLog(
      actor.id,
      "RAID_PARTICIPANT_UPDATED",
      "ReservoirRaidParticipant",
      regId,
      pickSnapshot(jsonSafe(participant)),
      pickSnapshot(jsonSafe(updated)),
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, context: Params) {
  try {
    const actor = await requireMinRole("r4");
    const { id: planId, regId } = await context.params;

    const participant = await prisma.reservoirRaidParticipant.findFirst({
      where: { id: regId, planId },
    });
    if (!participant) return NextResponse.json({ errorCode: "notFound" }, { status: 404 });

    await prisma.reservoirRaidParticipant.delete({ where: { id: regId } });
    await createAuditLog(actor.id, "RAID_PARTICIPANT_DELETED", "ReservoirRaidParticipant", regId, pickSnapshot(jsonSafe(participant)));

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
