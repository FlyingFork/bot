import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@tiles-survive/database";
import { createAuditLog } from "@/lib/audit";
import { jsonSafe, pickSnapshot } from "@/lib/json";
import { apiError, requireMinRole } from "@/lib/server-auth";
import { matchMemberByName, matchParticipantByName } from "@/lib/phase6";
import type { RegistrationStatus } from "@tiles-survive/database";

type PlayerEntry = { name: string; participant: boolean; reservist: boolean };

type Params = { params: Promise<{ id: string }> };

function deriveStatus(participant: boolean, reservist: boolean, hasMember: boolean): RegistrationStatus {
  if (participant) return "SELECTED_PARTICIPANT";
  if (reservist) return "SELECTED_RESERVIST";
  return hasMember ? "MATCHED" : "UNMATCHED";
}

export async function POST(request: NextRequest, context: Params) {
  try {
    const actor = await requireMinRole("r4");
    const { id: planId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;

    const plan = await prisma.reservoirRaidPlan.findUnique({ where: { id: planId }, select: { id: true } });
    if (!plan) return NextResponse.json({ errorCode: "notFound" }, { status: 404 });

    if (!Array.isArray(body.players) || body.players.length === 0) {
      return NextResponse.json({ errorCode: "playersRequired" }, { status: 400 });
    }

    const players = body.players as PlayerEntry[];
    for (const p of players) {
      if (typeof p.name !== "string" || !p.name.trim()) {
        return NextResponse.json({ errorCode: "invalidRow" }, { status: 400 });
      }
    }

    let created = 0;
    let updated = 0;
    let matched = 0;

    for (const entry of players) {
      const name = entry.name.trim();
      const isParticipant = Boolean(entry.participant);
      const isReservist = Boolean(entry.reservist);

      const [existingParticipant, matchedMember] = await Promise.all([
        matchParticipantByName(planId, name),
        matchMemberByName(name),
      ]);

      const hasMember = Boolean(matchedMember);
      const canonicalName = matchedMember?.username ?? name;

      if (existingParticipant) {
        // Existing player: only update participant/reservist flags and derive status
        // from their current member link — do not touch username or memberId.
        const existingHasMember = Boolean(existingParticipant.memberId);
        const existingStatus = deriveStatus(isParticipant, isReservist, existingHasMember);
        await prisma.reservoirRaidParticipant.update({
          where: { id: existingParticipant.id },
          data: { participant: isParticipant, reservist: isReservist, registrationStatus: existingStatus },
        });
        updated++;
      } else {
        const nameConflict = await prisma.reservoirRaidParticipant.findFirst({
          where: {
            planId,
            OR: [
              { username: canonicalName },
              ...(matchedMember ? [{ memberId: matchedMember.id }] : []),
            ],
          },
          select: { id: true, memberId: true },
        });

        if (nameConflict) {
          // Same rule: only touch participant/reservist flags.
          const conflictHasMember = Boolean(nameConflict.memberId);
          const conflictStatus = deriveStatus(isParticipant, isReservist, conflictHasMember);
          await prisma.reservoirRaidParticipant.update({
            where: { id: nameConflict.id },
            data: { participant: isParticipant, reservist: isReservist, registrationStatus: conflictStatus },
          });
          updated++;
        } else {
          // New player: create with full member match data.
          if (hasMember) matched++;
          await prisma.reservoirRaidParticipant.create({
            data: {
              planId,
              username: canonicalName,
              memberId: matchedMember?.id ?? null,
              participant: isParticipant,
              reservist: isReservist,
              registrationStatus: deriveStatus(isParticipant, isReservist, hasMember),
            },
          });
          created++;
        }
      }
    }

    await createAuditLog(
      actor.id,
      "RAID_PARTICIPANTS_IMPORTED",
      "ReservoirRaidPlan",
      planId,
      undefined,
      pickSnapshot(jsonSafe({ created, updated, matched, total: players.length })),
    );

    return NextResponse.json({ ok: true, created, updated, matched });
  } catch (error) {
    return apiError(error);
  }
}
