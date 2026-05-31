import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@tiles-survive/database";
import { createAuditLog } from "@/lib/audit";
import { jsonSafe, pickSnapshot } from "@/lib/json";
import { apiError, requireMinRole } from "@/lib/server-auth";
import { matchMemberByName } from "@/lib/phase6";
import type { RegistrationStatus, ReservoirRaidContactType } from "@tiles-survive/database";

const VALID_STATUSES: RegistrationStatus[] = [
  "MATCHED",
  "SELECTED_PARTICIPANT",
  "SELECTED_RESERVIST",
  "NOT_SELECTED",
];

const MAX_SQUADS = 5;
const MAX_POWER = 100_000_000_000;

type SquadEntry = { squadIndex: number; power: number };

function parseSquadPowers(value: unknown): SquadEntry[] | null {
  if (!Array.isArray(value)) return null;
  if (value.length === 0) return [];
  if (value.length > MAX_SQUADS) return null;
  const seen = new Set<number>();
  const squads: SquadEntry[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) return null;
    const { squadIndex, power } = item as Record<string, unknown>;
    if (typeof squadIndex !== "number" || !Number.isInteger(squadIndex) || squadIndex < 1 || squadIndex > MAX_SQUADS) return null;
    if (seen.has(squadIndex)) return null;
    if (typeof power !== "number" || !Number.isFinite(power) || power <= 0 || power > MAX_POWER) return null;
    seen.add(squadIndex);
    squads.push({ squadIndex, power });
  }
  return squads;
}

type Params = { params: Promise<{ id: string; regId: string }> };

export async function PATCH(request: NextRequest, context: Params) {
  try {
    const actor = await requireMinRole("r4");
    const { id: planId, regId } = await context.params;
    const body = (await request.json()) as {
      memberId?: string | null;
      registrationStatus?: string;
      username?: string;
      squadPowers?: unknown;
      contactType?: string | null;
      contact?: string | null;
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

    if (body.username !== undefined) {
      const newUsername = typeof body.username === "string" ? body.username.trim() : "";
      if (!newUsername || newUsername.length > 80) {
        return NextResponse.json({ errorCode: "usernameRequired" }, { status: 400 });
      }
      const nameConflict = await prisma.reservoirRaidParticipant.findFirst({
        where: { planId, username: newUsername, id: { not: regId } },
        select: { id: true },
      });
      if (nameConflict) return NextResponse.json({ errorCode: "usernameTaken" }, { status: 409 });

      const reMatched = await matchMemberByName(newUsername);
      data.username = reMatched?.username ?? newUsername;
      data.memberId = reMatched?.id ?? null;
      data.registrationStatus = reMatched ? "MATCHED" : "UNMATCHED";
    }

    if ("contactType" in body) {
      const validContactTypes = ["DISCORD", "TELEGRAM"];
      const rawContactType = typeof body.contactType === "string" ? body.contactType : null;
      const contactType =
        rawContactType && validContactTypes.includes(rawContactType)
          ? (rawContactType as ReservoirRaidContactType)
          : null;
      data.contactType = contactType;
      data.contact = contactType && typeof body.contact === "string" ? (body.contact.trim() || null) : null;
    }

    const updated = await prisma.reservoirRaidParticipant.update({
      where: { id: regId },
      data,
    });

    if (body.squadPowers !== undefined) {
      const squads = parseSquadPowers(body.squadPowers);
      if (squads === null) return NextResponse.json({ errorCode: "invalidSquadPowers" }, { status: 400 });
      const resolvedMemberId = typeof updated.memberId === "string" ? updated.memberId : null;
      await prisma.reservoirRaidParticipant.update({
        where: { id: regId },
        data: {
          squadPowers: {
            deleteMany: {},
            create: squads.map((sq) => ({
              squadIndex: sq.squadIndex,
              power: BigInt(Math.round(sq.power)),
              memberId: resolvedMemberId,
            })),
          },
        },
      });
    }

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
