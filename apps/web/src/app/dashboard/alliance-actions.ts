"use server";

import { auth } from "@/lib/auth";
import { prisma, type AllianceEventType, type AllianceRank } from "@tiles-survive/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

const ranks = new Set(["R5", "R4", "R3", "R2", "R1"]);
const eventTypes = new Set(["ALLIANCE_SIEGE", "EXPLORATION"]);

type InvalidRow = {
  row: number;
  messages: UiMessage[];
};

export type UiMessage = {
  key: string;
  values?: Record<string, number | string>;
};

type ParsedPower = {
  value: bigint | null;
  message?: UiMessage;
};

type ParsedRosterRow = {
  username: string;
  power: bigint;
  powerPlantLevel: number;
  rank: AllianceRank;
};

type ParsedEventRow = {
  username: string;
  power: bigint;
  explorationLevel: number | null;
};

export type RosterPreview = {
  error?: UiMessage;
  rows: {
    username: string;
    power: string;
    powerPlantLevel: number;
    rank: string;
    status: "create" | "update";
  }[];
  invalidRows: InvalidRow[];
  omittedMembers: { id: string; username: string }[];
};

export type EventPreview = {
  error?: UiMessage;
  rows: {
    username: string;
    power: string;
    explorationLevel: number | null;
    status: "matched" | "unmatched";
  }[];
  invalidRows: InvalidRow[];
};

export type ApplyResult = {
  success: boolean;
  pending?: true;
  message?: UiMessage;
};

function message(
  key: string,
  values?: Record<string, number | string>,
): UiMessage {
  return { key, values };
}

function isMessage(value: UiMessage | null): value is UiMessage {
  return value !== null;
}

async function requireVerifiedSession() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session || session.user.emailVerified !== true) {
    throw new Error("Unauthorized");
  }

  return session;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parsePower(value: unknown): ParsedPower {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) {
      return { value: null, message: message("actions.powerSafeInteger") };
    }

    return { value: BigInt(value) };
  }

  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return { value: BigInt(value.trim()) };
  }

  return { value: null, message: message("actions.powerInteger") };
}

function parseLevel(value: unknown, key: string) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    return message(key);
  }

  return null;
}

function parseJsonObject(payload: string) {
  try {
    const value: unknown = JSON.parse(payload);

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { error: message("actions.jsonObject") };
    }

    return { value: value as Record<string, unknown> };
  } catch {
    return { error: message("actions.jsonParse") };
  }
}

function parseRosterPayload(payload: string) {
  const parsed = parseJsonObject(payload);
  const invalidRows: InvalidRow[] = [];
  const rows: ParsedRosterRow[] = [];
  const seen = new Set<string>();

  if (!parsed.value) {
    return { error: parsed.error, invalidRows, rows };
  }

  if (!Array.isArray(parsed.value.members)) {
    return {
      error: message("actions.membersArray"),
      invalidRows,
      rows,
    };
  }

  parsed.value.members.forEach((raw, index) => {
    const rowNumber = index + 1;

    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      invalidRows.push({
        row: rowNumber,
        messages: [message("actions.memberObject")],
      });
      return;
    }

    const row = raw as Record<string, unknown>;
    const username = text(row.username);
    const power = parsePower(row.power);
    const levelError = parseLevel(
      row.powerPlantLevel,
      "actions.powerPlantLevelInteger",
    );
    const rank = text(row.rank);
    const rowErrors = [
      !username ? message("actions.usernameRequired") : null,
      seen.has(username) ? message("actions.usernameDuplicate") : null,
      power.message ?? null,
      levelError,
      !ranks.has(rank) ? message("actions.rank") : null,
    ].filter(isMessage);

    if (rowErrors.length || power.value === null || typeof row.powerPlantLevel !== "number") {
      invalidRows.push({ row: rowNumber, messages: rowErrors });
      return;
    }

    seen.add(username);
    rows.push({
      username,
      power: power.value,
      powerPlantLevel: row.powerPlantLevel,
      rank: rank as AllianceRank,
    });
  });

  return { invalidRows, rows };
}

function parseEventPayload(eventType: AllianceEventType, payload: string) {
  const parsed = parseJsonObject(payload);
  const invalidRows: InvalidRow[] = [];
  const rows: ParsedEventRow[] = [];
  const seen = new Set<string>();

  if (!parsed.value) {
    return { error: parsed.error, invalidRows, rows };
  }

  if (!Array.isArray(parsed.value.entries)) {
    return {
      error: message("actions.entriesArray"),
      invalidRows,
      rows,
    };
  }

  parsed.value.entries.forEach((raw, index) => {
    const rowNumber = index + 1;

    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      invalidRows.push({
        row: rowNumber,
        messages: [message("actions.eventObject")],
      });
      return;
    }

    const row = raw as Record<string, unknown>;
    const username = text(row.username);
    const power = parsePower(row.power);
    const explorationError =
      eventType === "EXPLORATION"
        ? parseLevel(row.explorationLevel, "actions.explorationLevelInteger")
        : null;
    const rowErrors = [
      !username ? message("actions.usernameRequired") : null,
      seen.has(username) ? message("actions.usernameDuplicate") : null,
      power.message ?? null,
      explorationError,
    ].filter(isMessage);

    if (
      rowErrors.length ||
      power.value === null ||
      (eventType === "EXPLORATION" && typeof row.explorationLevel !== "number")
    ) {
      invalidRows.push({ row: rowNumber, messages: rowErrors });
      return;
    }

    seen.add(username);
    rows.push({
      username,
      power: power.value,
      explorationLevel:
        eventType === "EXPLORATION" ? (row.explorationLevel as number) : null,
    });
  });

  return { invalidRows, rows };
}

function validateEventType(value: string): AllianceEventType {
  if (!eventTypes.has(value)) {
    throw new Error("Unsupported event type.");
  }

  return value as AllianceEventType;
}

function refreshAlliancePaths() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/alliance-settings");
  revalidatePath("/dashboard/members");
  revalidatePath("/dashboard/members/archive");
  revalidatePath("/dashboard/events/alliance-siege");
  revalidatePath("/dashboard/events/exploration");
}

export async function updateAllianceSettings(
  _previousState: ApplyResult,
  formData: FormData,
): Promise<ApplyResult> {
  await requireVerifiedSession();
  const name = text(formData.get("name"));
  const tag = text(formData.get("tag"));

  await prisma.allianceSettings.upsert({
    where: { id: "primary" },
    update: { name, tag },
    create: { id: "primary", name, tag },
  });

  refreshAlliancePaths();
  return { success: true, message: message("actions.settingsSaved") };
}

export async function previewRosterImport(payload: string): Promise<RosterPreview> {
  await requireVerifiedSession();
  const parsed = parseRosterPayload(payload);

  if (parsed.error) {
    return { error: parsed.error, rows: [], invalidRows: [], omittedMembers: [] };
  }

  const usernames = parsed.rows.map((row) => row.username);
  const [existing, omittedMembers] = await Promise.all([
    prisma.allianceMember.findMany({
      where: { username: { in: usernames } },
      select: { username: true },
    }),
    prisma.allianceMember.findMany({
      where: { active: true, username: { notIn: usernames } },
      orderBy: { username: "asc" },
      select: { id: true, username: true },
    }),
  ]);
  const known = new Set(existing.map((member) => member.username));

  return {
    rows: parsed.rows.map((row) => ({
      username: row.username,
      power: row.power.toString(),
      powerPlantLevel: row.powerPlantLevel,
      rank: row.rank,
      status: known.has(row.username) ? "update" : "create",
    })),
    invalidRows: parsed.invalidRows,
    omittedMembers,
  };
}

export async function applyRosterImport(
  payload: string,
  archiveOmitted: boolean,
): Promise<ApplyResult> {
  const session = await requireVerifiedSession();
  const parsed = parseRosterPayload(payload);

  if (parsed.error || parsed.invalidRows.length || !parsed.rows.length) {
    return {
      success: false,
      message: parsed.error ?? message("actions.fixRosterRows"),
    };
  }

  const importedAt = new Date();
  const usernames = parsed.rows.map((row) => row.username);

  await prisma.$transaction(
    async (tx) => {
      const batch = await tx.allianceRosterImport.create({
        data: { actorId: session.user.id },
      });
      const snapshots = [];

      for (const row of parsed.rows) {
        const member = await tx.allianceMember.upsert({
          where: { username: row.username },
          update: {
            active: true,
            currentPower: row.power,
            currentPowerPlantLevel: row.powerPlantLevel,
            currentRank: row.rank,
            lastRosterImportedAt: importedAt,
          },
          create: {
            username: row.username,
            active: true,
            currentPower: row.power,
            currentPowerPlantLevel: row.powerPlantLevel,
            currentRank: row.rank,
            lastRosterImportedAt: importedAt,
          },
          select: { id: true },
        });

        snapshots.push({
          importId: batch.id,
          memberId: member.id,
          power: row.power,
          powerPlantLevel: row.powerPlantLevel,
          rank: row.rank,
          importedAt,
        });
      }

      await tx.allianceRosterSnapshot.createMany({ data: snapshots });

      if (archiveOmitted) {
        await tx.allianceMember.updateMany({
          where: { active: true, username: { notIn: usernames } },
          data: { active: false },
        });
      }
    },
    { timeout: 20_000 },
  );

  refreshAlliancePaths();
  return {
    success: true,
    message: message("actions.rosterApplied", { count: parsed.rows.length }),
  };
}

export async function previewEventImport(
  eventTypeInput: string,
  payload: string,
): Promise<EventPreview> {
  await requireVerifiedSession();
  const eventType = validateEventType(eventTypeInput);
  const parsed = parseEventPayload(eventType, payload);

  if (parsed.error) {
    return { error: parsed.error, rows: [], invalidRows: [] };
  }

  const existing = await prisma.allianceMember.findMany({
    where: { username: { in: parsed.rows.map((row) => row.username) } },
    select: { username: true },
  });
  const known = new Set(existing.map((member) => member.username));

  return {
    rows: parsed.rows.map((row) => ({
      username: row.username,
      power: row.power.toString(),
      explorationLevel: row.explorationLevel,
      status: known.has(row.username) ? "matched" : "unmatched",
    })),
    invalidRows: parsed.invalidRows,
  };
}

export async function applyEventImport(
  eventTypeInput: string,
  payload: string,
  acceptedUsernames: string[],
): Promise<ApplyResult> {
  const session = await requireVerifiedSession();
  const eventType = validateEventType(eventTypeInput);
  const parsed = parseEventPayload(eventType, payload);

  if (parsed.error || parsed.invalidRows.length || !parsed.rows.length) {
    return {
      success: false,
      message: parsed.error ?? message("actions.fixEventRows"),
    };
  }

  const existing = await prisma.allianceMember.findMany({
    where: { username: { in: parsed.rows.map((row) => row.username) } },
    select: { id: true, username: true },
  });
  const members = new Map(existing.map((member) => [member.username, member]));
  const accepted = new Set(acceptedUsernames.map((username) => username.trim()));
  const rowsToStore = parsed.rows.filter(
    (row) => members.has(row.username) || accepted.has(row.username),
  );

  if (!rowsToStore.length) {
    return { success: false, message: message("actions.noStoredEventRows") };
  }

  if (session.user.role !== "admin") {
    await prisma.pendingChange.create({
      data: {
        type: "EVENT_IMPORT",
        payload: JSON.stringify({ eventType, payload, acceptedUsernames }),
        submitterId: session.user.id,
      },
    });
    return { success: true, pending: true };
  }

  const importedAt = new Date();

  await prisma.$transaction(async (tx) => {
    const batch = await tx.allianceEventImport.create({
      data: { actorId: session.user.id, eventType },
    });

    for (const row of rowsToStore) {
      const knownMember = members.get(row.username);
      const member = knownMember
        ? knownMember
        : await tx.allianceMember.create({
            data: { username: row.username, active: true },
            select: { id: true, username: true },
          });

      await tx.allianceEventSnapshot.create({
        data: {
          importId: batch.id,
          memberId: member.id,
          eventType,
          power: row.power,
          explorationLevel: row.explorationLevel,
          importedAt,
        },
      });
    }
  });

  refreshAlliancePaths();
  return {
    success: true,
    message: message("actions.eventStored", { count: rowsToStore.length }),
  };
}
