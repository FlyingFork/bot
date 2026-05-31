import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@tiles-survive/database";
import { createAuditLog } from "@/lib/audit";
import { jsonSafe, pickSnapshot } from "@/lib/json";
import { apiError, requireMinRole } from "@/lib/server-auth";
import { matchMemberByName } from "@/lib/phase6";
import type { ReservoirRaidContactType } from "@tiles-survive/database";

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

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Params) {
  try {
    const actor = await requireMinRole("r4");
    const { id: planId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;

    const plan = await prisma.reservoirRaidPlan.findUnique({ where: { id: planId }, select: { id: true } });
    if (!plan) return NextResponse.json({ errorCode: "notFound" }, { status: 404 });

    const username = typeof body.username === "string" ? body.username.trim() : "";
    if (!username || username.length > 80) {
      return NextResponse.json({ errorCode: "usernameRequired" }, { status: 400 });
    }

    const squadPowers = body.squadPowers !== undefined ? parseSquadPowers(body.squadPowers) : [];
    if (squadPowers === null) {
      return NextResponse.json({ errorCode: "invalidSquadPowers" }, { status: 400 });
    }

    const validContactTypes = ["DISCORD", "TELEGRAM"];
    const rawContactType = typeof body.contactType === "string" ? body.contactType : null;
    const contactType =
      rawContactType && validContactTypes.includes(rawContactType)
        ? (rawContactType as ReservoirRaidContactType)
        : null;
    const contact = contactType && typeof body.contact === "string" ? (body.contact.trim() || null) : null;
    if (contact && contact.length > 80) {
      return NextResponse.json({ errorCode: "contactTooLong" }, { status: 400 });
    }

    const matchedMember = await matchMemberByName(username);
    const canonicalName = matchedMember?.username ?? username;

    const existing = await prisma.reservoirRaidParticipant.findFirst({
      where: {
        planId,
        OR: [
          { username: canonicalName },
          ...(matchedMember ? [{ memberId: matchedMember.id }] : []),
        ],
      },
      select: { id: true },
    });
    if (existing) return NextResponse.json({ errorCode: "alreadyExists" }, { status: 409 });

    const created = await prisma.reservoirRaidParticipant.create({
      data: {
        planId,
        username: canonicalName,
        memberId: matchedMember?.id ?? null,
        contactType,
        contact,
        registrationStatus: matchedMember ? "MATCHED" : "UNMATCHED",
        squadPowers: squadPowers.length > 0
          ? {
              create: squadPowers.map((sq) => ({
                squadIndex: sq.squadIndex,
                power: BigInt(Math.round(sq.power)),
                memberId: matchedMember?.id ?? null,
              })),
            }
          : undefined,
      },
    });

    await createAuditLog(
      actor.id,
      "RAID_PARTICIPANT_ADDED",
      "ReservoirRaidParticipant",
      created.id,
      undefined,
      pickSnapshot(jsonSafe(created)),
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
