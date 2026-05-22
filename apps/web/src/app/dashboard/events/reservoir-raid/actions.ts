"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@tiles-survive/database";
import { auth } from "@/lib/auth";
import {
  isSundayUtc,
  parseRaidPower,
  raidDateFromInput,
  raidStartFromInput,
} from "@/lib/reservoir-raid";
import { OBJECTIVE_IDS } from "@/data/tilessurvive-objectives";
import type { ObjectiveId } from "@/types/objectives";

export type AssignmentMutationResult = {
  ok: boolean;
  updatedAt?: string;
};

export type RaidActionResult = {
  ok: boolean;
  pending?: true;
  message?: string;
  values?: Record<string, number | string>;
};

export type PublicRaidRegistrationInput = {
  username: string;
  squad1Power: string;
  squad2Power?: string;
  squad3Power?: string;
  squad4Power?: string;
  squad5Power?: string;
  contactType?: string;
  contact?: string;
  confirmed: boolean;
};

export type PublicRaidRegistrationResult = RaidActionResult & {
  fieldErrors?: Partial<Record<keyof PublicRaidRegistrationInput, string>>;
};

type StoredRegistration = {
  username: string;
  contactType: "DISCORD" | "TELEGRAM" | null;
  contact: string | null;
  confirmed: true;
  powers: { power: bigint; squadIndex: number }[];
};

const participantLimit = 30;
const reservistLimit = 10;

type ParsedRegistration =
  | { ok: true; row: StoredRegistration }
  | {
      ok: false;
      fieldErrors: PublicRaidRegistrationResult["fieldErrors"];
    };

async function requireVerifiedSession() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session || session.user.emailVerified !== true) {
    throw new Error("Unauthorized");
  }

  return session;
}

function validObjectiveId(value: string): value is ObjectiveId {
  return OBJECTIVE_IDS.has(value as ObjectiveId);
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseContactType(value: unknown) {
  const normalized = text(value).toLowerCase();

  if (normalized === "discord") {
    return "DISCORD" as const;
  }

  if (normalized === "telegram") {
    return "TELEGRAM" as const;
  }

  return null;
}

function parseRegistration(input: PublicRaidRegistrationInput): ParsedRegistration {
  const username = text(input.username);
  const contact = text(input.contact);
  const contactType = parseContactType(input.contactType);
  const firstPower = parseRaidPower(input.squad1Power);
  const optionalPowerFields = ["squad2Power", "squad3Power", "squad4Power", "squad5Power"] as const;
  const optionalPowers = [input.squad2Power, input.squad3Power, input.squad4Power, input.squad5Power].map(
    (value) => (text(value) ? parseRaidPower(value) : null),
  );
  const fieldErrors: PublicRaidRegistrationResult["fieldErrors"] = {};

  if (!username) {
    fieldErrors.username = "usernameRequired";
  } else if (username.length > 80) {
    fieldErrors.username = "usernameLength";
  }

  if (!firstPower.ok) {
    fieldErrors.squad1Power = firstPower.message;
  }

  optionalPowers.forEach((power, index) => {
    if (power && !power.ok) {
      fieldErrors[optionalPowerFields[index]] = power.message;
    }
  });

  if (contact && !contactType) {
    fieldErrors.contactType = "contactType";
  }

  if (contactType && !contact) {
    fieldErrors.contact = "contactRequired";
  }

  if (!input.confirmed) {
    fieldErrors.confirmed = "confirmationRequired";
  }

  if (Object.keys(fieldErrors).length || !firstPower.ok) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    row: {
      username,
      contactType: contact ? contactType : null,
      contact: contact || null,
      confirmed: true,
      powers: [
        { squadIndex: 1, power: firstPower.value },
        ...optionalPowers.flatMap((power, index) =>
          power && power.ok
            ? [{ squadIndex: index + 2, power: power.value }]
            : [],
        ),
      ],
    },
  };
}

function refreshPlan(planId: string) {
  revalidatePath("/dashboard/events/reservoir-raid");
  revalidatePath(`/dashboard/events/reservoir-raid/${planId}`);
}

async function saveRegistration(planId: string, row: StoredRegistration) {
  const member = await prisma.allianceMember.findFirst({
    where: { active: true, username: row.username },
    select: { id: true },
  });

  return prisma.$transaction(async (tx) => {
    const participant = await tx.reservoirRaidParticipant.upsert({
      where: {
        planId_username: {
          planId,
          username: row.username,
        },
      },
      create: {
        planId,
        username: row.username,
        memberId: member?.id ?? null,
        contactType: row.contactType,
        contact: row.contact,
        confirmed: row.confirmed,
      },
      update: {
        memberId: member?.id ?? null,
        contactType: row.contactType,
        contact: row.contact,
        confirmed: row.confirmed,
      },
      select: { id: true },
    });

    await tx.reservoirRaidSquadPower.deleteMany({
      where: { participantId: participant.id },
    });

    await tx.reservoirRaidSquadPower.createMany({
      data: row.powers.map((power) => ({
        participantId: participant.id,
        memberId: member?.id ?? null,
        squadIndex: power.squadIndex,
        power: power.power,
      })),
    });

    await tx.reservoirRaidPlan.update({
      where: { id: planId },
      data: { updatedAt: new Date() },
    });

    return participant;
  });
}

export async function createRaidPlan(formData: FormData) {
  await requireVerifiedSession();
  const raidDate = raidDateFromInput(formData.get("raidDate"));
  const startsAt = raidDate
    ? raidStartFromInput(raidDate, formData.get("eventTimeUtc"))
    : null;

  if (!raidDate || !isSundayUtc(raidDate) || !startsAt) {
    throw new Error("Reservoir Raid plans require a Sunday date and a UTC event time.");
  }

  const existing = await prisma.reservoirRaidPlan.findUnique({
    where: { raidDate },
    select: { id: true },
  });

  if (existing) {
    redirect(`/dashboard/events/reservoir-raid/${existing.id}`);
  }

  const plan = await prisma.reservoirRaidPlan.create({
    data: {
      raidDate,
      startsAt,
      publicToken: randomBytes(24).toString("base64url"),
    },
    select: { id: true },
  });

  revalidatePath("/dashboard/events/reservoir-raid");
  redirect(`/dashboard/events/reservoir-raid/${plan.id}`);
}

export async function updateRaidPlanTime(
  planId: string,
  eventTimeUtc: string,
): Promise<RaidActionResult> {
  await requireVerifiedSession();
  const plan = await prisma.reservoirRaidPlan.findUnique({
    where: { id: planId },
    select: { raidDate: true },
  });
  const startsAt = plan ? raidStartFromInput(plan.raidDate, eventTimeUtc) : null;

  if (!startsAt) {
    return { ok: false, message: "timeInvalid" };
  }

  await prisma.reservoirRaidPlan.update({
    where: { id: planId },
    data: { startsAt },
  });
  refreshPlan(planId);
  return { ok: true, message: "timeUpdated" };
}

export async function setRaidRegistrationOpen(
  planId: string,
  registrationOpen: boolean,
): Promise<RaidActionResult> {
  await requireVerifiedSession();
  await prisma.reservoirRaidPlan.update({
    where: { id: planId },
    data: { registrationOpen },
  });
  refreshPlan(planId);
  return {
    ok: true,
    message: registrationOpen ? "registrationOpened" : "registrationClosed",
  };
}

export async function submitPublicRaidRegistration(
  token: string,
  input: PublicRaidRegistrationInput,
): Promise<PublicRaidRegistrationResult> {
  const plan = await prisma.reservoirRaidPlan.findUnique({
    where: { publicToken: token },
    select: { id: true, registrationOpen: true },
  });

  if (!plan) {
    return { ok: false, message: "linkUnavailable" };
  }

  if (!plan.registrationOpen) {
    return { ok: false, message: "registrationClosed" };
  }

  const parsed = parseRegistration(input);

  if (!parsed.ok) {
    return { ok: false, fieldErrors: parsed.fieldErrors };
  }

  await saveRegistration(plan.id, parsed.row);
  refreshPlan(plan.id);
  revalidatePath(`/reservoir-raid/register/${token}`);

  return {
    ok: true,
    message: "saved",
  };
}

export async function importRaidRegistrations(
  planId: string,
  payload: string,
): Promise<RaidActionResult> {
  const session = await requireVerifiedSession();

  let parsedPayload: unknown;

  try {
    parsedPayload = JSON.parse(payload);
  } catch {
    return { ok: false, message: "jsonParse" };
  }

  if (
    !parsedPayload ||
    typeof parsedPayload !== "object" ||
    !Array.isArray((parsedPayload as { registrations?: unknown }).registrations)
  ) {
    return { ok: false, message: "registrationsArray" };
  }

  const registrations = (parsedPayload as { registrations: unknown[] }).registrations;
  const rows: StoredRegistration[] = [];
  const invalidRows: number[] = [];
  const seen = new Set<string>();

  registrations.forEach((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      invalidRows.push(index + 1);
      return;
    }

    const row = value as Record<string, unknown>;
    const parsed = parseRegistration({
      username: text(row.username),
      squad1Power: text(row.squad1Power),
      squad2Power: text(row.squad2Power),
      squad3Power: text(row.squad3Power),
      squad4Power: text(row.squad4Power),
      squad5Power: text(row.squad5Power),
      contactType: text(row.contactType),
      contact: text(row.contact),
      confirmed: row.confirmed === true,
    });

    if (!parsed.ok) {
      invalidRows.push(index + 1);
      return;
    }

    if (seen.has(parsed.row.username)) {
      invalidRows.push(index + 1);
      return;
    }

    seen.add(parsed.row.username);
    rows.push(parsed.row);
  });

  if (!rows.length || invalidRows.length) {
    return {
      ok: false,
      message: invalidRows.length
        ? "invalidRows"
        : "noRows",
      values: invalidRows.length ? { rows: invalidRows.join(", ") } : undefined,
    };
  }

  const plan = await prisma.reservoirRaidPlan.findUnique({
    where: { id: planId },
    select: { id: true },
  });

  if (!plan) {
    return { ok: false, message: "planMissing" };
  }

  if (session.user.role !== "admin") {
    await prisma.pendingChange.create({
      data: {
        type: "RAID_REGISTRATIONS",
        payload: JSON.stringify({ planId, payload }),
        submitterId: session.user.id,
      },
    });
    return { ok: true, pending: true };
  }

  for (const row of rows) {
    await saveRegistration(plan.id, row);
  }

  refreshPlan(plan.id);
  return { ok: true, message: "loaded", values: { count: rows.length } };
}

export async function promoteRaidParticipant(
  participantId: string,
): Promise<RaidActionResult> {
  await requireVerifiedSession();
  const participant = await prisma.reservoirRaidParticipant.findUnique({
    where: { id: participantId },
    select: { id: true, planId: true, username: true },
  });

  if (!participant) {
    return { ok: false, message: "participantMissing" };
  }

  const member = await prisma.allianceMember.upsert({
    where: { username: participant.username },
    update: { active: true },
    create: { username: participant.username, active: true },
    select: { id: true },
  });

  await prisma.$transaction([
    prisma.reservoirRaidParticipant.update({
      where: { id: participant.id },
      data: { memberId: member.id },
    }),
    prisma.reservoirRaidSquadPower.updateMany({
      where: { participantId: participant.id },
      data: { memberId: member.id },
    }),
  ]);

  refreshPlan(participant.planId);
  revalidatePath("/dashboard/members");
  revalidatePath("/dashboard/members/archive");
  return { ok: true, message: "promoted" };
}

export async function setRaidRosterFlag({
  enabled,
  participantId,
  slot,
}: {
  enabled: boolean;
  participantId: string;
  slot: "participant" | "reservist";
}): Promise<RaidActionResult> {
  await requireVerifiedSession();
  const raidParticipant = await prisma.reservoirRaidParticipant.findUnique({
    where: { id: participantId },
    select: {
      id: true,
      planId: true,
      participant: true,
      reservist: true,
    },
  });

  if (!raidParticipant) {
    return { ok: false, message: "participantMissing" };
  }

  if (enabled) {
    const limit = slot === "participant" ? participantLimit : reservistLimit;
    const current = await prisma.reservoirRaidParticipant.count({
      where: {
        planId: raidParticipant.planId,
        [slot]: true,
        id: { not: raidParticipant.id },
      },
    });

    if (current >= limit) {
      return {
        ok: false,
        message: slot === "participant" ? "participantLimit" : "reservistLimit",
        values: { count: limit },
      };
    }
  }

  await prisma.reservoirRaidParticipant.update({
    where: { id: raidParticipant.id },
    data:
      slot === "participant"
        ? { participant: enabled, reservist: enabled ? false : raidParticipant.reservist }
        : { reservist: enabled, participant: enabled ? false : raidParticipant.participant },
  });

  refreshPlan(raidParticipant.planId);
  return {
    ok: true,
    message: enabled
      ? slot === "participant"
        ? "participantMarked"
        : "reservistMarked"
      : slot === "participant"
        ? "participantCleared"
        : "reservistCleared",
  };
}

export async function setAssignment({
  assigned,
  participantId,
  objectiveId,
  planId,
}: {
  assigned: boolean;
  participantId: string;
  objectiveId: string;
  planId: string;
}): Promise<AssignmentMutationResult> {
  await requireVerifiedSession();

  if (!validObjectiveId(objectiveId)) {
    return { ok: false };
  }

  const participant = await prisma.reservoirRaidParticipant.findFirst({
    where: { id: participantId, planId },
    select: { id: true },
  });

  if (!participant) {
    return { ok: false };
  }

  const updatedAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.reservoirRaidPlan.update({
      where: { id: planId },
      data: { updatedAt },
    });

    if (assigned) {
      await tx.reservoirRaidAssignment.createMany({
        data: {
          planId,
          objectiveId,
          participantId,
        },
        skipDuplicates: true,
      });
      return;
    }

    await tx.reservoirRaidAssignment.deleteMany({
      where: {
        planId,
        objectiveId,
        participantId,
      },
    });
  });

  return { ok: true, updatedAt: updatedAt.toISOString() };
}

export async function resetPlan(planId: string): Promise<AssignmentMutationResult> {
  await requireVerifiedSession();
  const updatedAt = new Date();

  await prisma.$transaction([
    prisma.reservoirRaidPlan.update({
      where: { id: planId },
      data: { updatedAt },
    }),
    prisma.reservoirRaidAssignment.deleteMany({
      where: { planId },
    }),
  ]);

  return { ok: true, updatedAt: updatedAt.toISOString() };
}
