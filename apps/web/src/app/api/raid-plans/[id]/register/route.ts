import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@tiles-survive/database";
import { apiError } from "@/lib/server-auth";
import { isRaidDateReached, matchMemberByName } from "@/lib/phase6";
import type { ReservoirRaidContactType } from "@tiles-survive/database";

type SquadEntry = { squadIndex: number; power: number };

type Params = { params: Promise<{ id: string }> };

const MAX_BODY_BYTES = 8 * 1024;
const MAX_SQUADS = 5;
const MAX_POWER = 100_000_000_000;
const MAX_CONTACT_LENGTH = 80;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const USERNAME_UPDATE_WINDOW_MS = 30 * 60 * 1000;
const MAX_REQUESTS_PER_IP = 20;
const MAX_REQUESTS_PER_TOKEN = 100;
const MAX_USERNAME_UPDATES = 5;

const requestBuckets = new Map<string, { count: number; resetAt: number }>();
const usernameUpdateBuckets = new Map<string, { count: number; resetAt: number }>();

function clientIp(request: NextRequest): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

function hitLimit(key: string, max: number, windowMs: number, store = requestBuckets): boolean {
  const now = Date.now();
  if (store.size > 10_000) {
    for (const [bucketKey, bucket] of store) {
      if (bucket.resetAt <= now) store.delete(bucketKey);
    }
  }
  const bucket = store.get(key);
  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  bucket.count += 1;
  return bucket.count > max;
}

async function readJsonBody(request: NextRequest): Promise<Record<string, unknown> | null> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) return null;

  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return null;

  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function parseSquadPowers(value: unknown): SquadEntry[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_SQUADS) return null;

  const seen = new Set<number>();
  const squads: SquadEntry[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) return null;
    const { squadIndex, power } = item as Record<string, unknown>;
    if (typeof squadIndex !== "number") return null;
    if (!Number.isInteger(squadIndex) || squadIndex < 1 || squadIndex > MAX_SQUADS) return null;
    if (seen.has(squadIndex)) return null;
    if (typeof power !== "number" || !Number.isFinite(power) || power <= 0 || power > MAX_POWER) return null;
    seen.add(squadIndex);
    squads.push({ squadIndex, power });
  }

  return squads;
}

export async function POST(request: NextRequest, context: Params) {
  try {
    const { id: publicToken } = await context.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(publicToken)) {
      return NextResponse.json({ errorCode: "notFound" }, { status: 404 });
    }

    const ip = clientIp(request);
    if (
      hitLimit(`raid-reg:ip:${ip}`, MAX_REQUESTS_PER_IP, RATE_WINDOW_MS) ||
      hitLimit(`raid-reg:token:${publicToken}`, MAX_REQUESTS_PER_TOKEN, RATE_WINDOW_MS)
    ) {
      return NextResponse.json({ errorCode: "tooManyRequests" }, { status: 429 });
    }

    const body = await readJsonBody(request);
    if (!body) {
      return NextResponse.json({ errorCode: "payloadTooLarge" }, { status: 413 });
    }

    const ingameName = typeof body.ingameName === "string" ? body.ingameName.trim() : "";
    if (!ingameName || ingameName.length > 80) {
      return NextResponse.json({ errorCode: "ingameNameRequired" }, { status: 400 });
    }

    const usernameLimitKey = `raid-reg:user:${publicToken}:${normalizeName(ingameName)}`;
    if (hitLimit(usernameLimitKey, MAX_USERNAME_UPDATES, USERNAME_UPDATE_WINDOW_MS, usernameUpdateBuckets)) {
      return NextResponse.json({ errorCode: "tooManyRequests" }, { status: 429 });
    }

    const squadPowers = parseSquadPowers(body.squadPowers);
    if (!squadPowers) {
      return NextResponse.json({ errorCode: "squad1Required" }, { status: 400 });
    }
    const s1 = squadPowers.find((s) => s.squadIndex === 1);
    if (!s1) {
      return NextResponse.json({ errorCode: "squad1Required" }, { status: 400 });
    }

    const plan = await prisma.reservoirRaidPlan.findUnique({ where: { publicToken } });
    if (!plan) return NextResponse.json({ errorCode: "notFound" }, { status: 404 });

    if (plan.registrationOpen && isRaidDateReached(plan.raidDate)) {
      await prisma.reservoirRaidPlan.update({ where: { id: plan.id }, data: { registrationOpen: false } });
      return NextResponse.json({ errorCode: "registrationClosed" }, { status: 400 });
    }
    if (!plan.registrationOpen) {
      return NextResponse.json({ errorCode: "registrationClosed" }, { status: 400 });
    }

    const matchedMember = await matchMemberByName(ingameName);
    if (matchedMember?.isTempAway) {
      return NextResponse.json({ errorCode: "tempAway" }, { status: 400 });
    }

    const validContactTypes = ["DISCORD", "TELEGRAM"];
    const requestedContactType = typeof body.contactType === "string" ? body.contactType : "";
    const contactType =
      requestedContactType && validContactTypes.includes(requestedContactType)
        ? (requestedContactType as ReservoirRaidContactType)
        : null;
    const contact = contactType && typeof body.contact === "string" ? (body.contact.trim() || null) : null;
    if (contact && contact.length > MAX_CONTACT_LENGTH) {
      return NextResponse.json({ errorCode: "contactTooLong" }, { status: 400 });
    }

    const existing = await prisma.reservoirRaidParticipant.findFirst({
      where: { planId: plan.id, username: ingameName },
    });

    if (existing) {
      if (
        existing.registrationStatus === "SELECTED_PARTICIPANT" ||
        existing.registrationStatus === "SELECTED_RESERVIST" ||
        existing.registrationStatus === "NOT_SELECTED"
      ) {
        return NextResponse.json({ errorCode: "registrationLocked" }, { status: 409 });
      }

      await prisma.reservoirRaidParticipant.update({
        where: { id: existing.id },
        data: {
          memberId: matchedMember?.id ?? existing.memberId,
          contactType,
          contact,
          registrationStatus: matchedMember ? "MATCHED" : existing.registrationStatus,
          squadPowers: {
            deleteMany: {},
            create: squadPowers.map((sq) => ({
              squadIndex: sq.squadIndex,
              power: BigInt(Math.round(sq.power)),
              memberId: matchedMember?.id ?? null,
            })),
          },
        },
      });
    } else {
      await prisma.reservoirRaidParticipant.create({
        data: {
          planId: plan.id,
          username: ingameName,
          memberId: matchedMember?.id ?? null,
          contactType,
          contact,
          registrationStatus: matchedMember ? "MATCHED" : "UNMATCHED",
          squadPowers: {
            create: squadPowers.map((sq) => ({
              squadIndex: sq.squadIndex,
              power: BigInt(Math.round(sq.power)),
              memberId: matchedMember?.id ?? null,
            })),
          },
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
