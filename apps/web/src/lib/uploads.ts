import { prisma, type AllianceRank, type LeaderboardType } from "@tiles-survive/database";
import { createAuditLog } from "@/lib/audit";
import { jsonSafe, pickSnapshot } from "@/lib/json";
import {
  LEADERBOARD_TYPES,
  UPLOAD_SCHEMA_FIELDS,
  type LeaderboardTypeName,
  type UploadKind,
} from "@/lib/upload-schemas";

export type UploadRow = Record<string, string | number>;

export type DiffEntry = {
  status: "new" | "changed" | "unchanged" | "removed" | "unmatched";
  playerName: string;
  field?: string;
  oldValue?: unknown;
  newValue?: unknown;
  row?: number;
  memberId?: string | null;
};

export type UploadTarget = {
  kind: UploadKind;
  leaderboardType?: LeaderboardTypeName | null;
  eventInstanceId?: string | null;
  eventInstanceType?: string | null;
  eventDay?: number | null;
};

export type ValidationResult = {
  rows: UploadRow[];
  errors: ValidationError[];
};

export type ValidationError = {
  code: "json" | "type" | "rowObject" | "missing" | "string" | "number";
  row?: number;
  field?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

const VALID_RANKS = new Set<string>(["R1", "R2", "R3", "R4", "R5"]);

function allianceRank(value: unknown): AllianceRank | undefined {
  return typeof value === "string" && VALID_RANKS.has(value)
    ? (value as AllianceRank)
    : undefined;
}

function totalPower(value: unknown): bigint | undefined {
  return typeof value === "number" ? BigInt(value) : undefined;
}

export function parseJsonRows(json: string): unknown[] {
  const parsed = JSON.parse(json);
  if (!Array.isArray(parsed)) throw new Error("array");
  return parsed;
}

export function validateRows(kind: UploadKind, leaderboardType: string | null | undefined, json: string): ValidationResult {
  let parsed: unknown[];
  try {
    parsed = parseJsonRows(json);
  } catch {
    return { rows: [], errors: [{ code: "json" }] };
  }

  const schemaKey = kind === "LEADERBOARD_SNAPSHOT" ? leaderboardType : kind;
  const fields = schemaKey ? UPLOAD_SCHEMA_FIELDS[schemaKey as keyof typeof UPLOAD_SCHEMA_FIELDS] : undefined;
  if (!fields) return { rows: [], errors: [{ code: "type" }] };

  const errors: ValidationError[] = [];
  const rows: UploadRow[] = [];

  parsed.forEach((item, index) => {
    const rowNumber = index + 1;
    if (!isRecord(item)) {
      errors.push({ code: "rowObject", row: rowNumber });
      return;
    }

    const row: UploadRow = {};
    for (const field of fields) {
      const value = item[field];
      if (value === undefined || value === null || value === "") {
        errors.push({ code: "missing", row: rowNumber, field });
        continue;
      }
      if (field === "playerName" || field === "allianceTag" || field === "heroName" || field === "allianceRank") {
        if (typeof value !== "string") errors.push({ code: "string", row: rowNumber, field });
        else row[field] = value.trim();
      } else if (!isFiniteNumber(value)) {
        errors.push({ code: "number", row: rowNumber, field });
      } else {
        row[field] = value;
      }
    }
    rows.push(row);
  });

  return { rows, errors };
}

export async function hasPendingUpload(target: UploadTarget) {
  if (target.kind === "LEADERBOARD_SNAPSHOT") {
    if (!target.leaderboardType) return false;
    return prisma.pendingChange.findFirst({
      where: {
        status: "PENDING",
        type: "LEADERBOARD_SNAPSHOT",
        leaderboardType: target.leaderboardType,
      },
      select: { id: true },
    });
  }

  if (target.kind === "ALLIANCE_DUEL_DAY") {
    if (!target.eventInstanceId || !target.eventDay) return false;
    return prisma.pendingChange.findFirst({
      where: {
        status: "PENDING",
        type: "ALLIANCE_DUEL_DAY",
        eventInstanceId: target.eventInstanceId,
        eventDay: target.eventDay,
      },
      select: { id: true },
    });
  }

  if (!target.eventInstanceId) return false;
  return prisma.pendingChange.findFirst({
    where: {
      status: "PENDING",
      type: "RESERVOIR_RAID_RESULTS",
      eventInstanceId: target.eventInstanceId,
    },
    select: { id: true },
  });
}

export async function matchUploadRows(rows: UploadRow[]) {
  const [settings, members] = await Promise.all([
    prisma.allianceSettings.findUnique({ where: { id: "primary" }, select: { tag: true } }),
    prisma.allianceMember.findMany({
      select: {
        id: true,
        username: true,
        isTempAway: true,
        tempAwayAllianceTag: true,
        nameHistory: { select: { name: true } },
      },
    }),
  ]);

  const byName = new Map<string, string>();
  const tempAwayByTag = new Map<string, string>();
  for (const member of members) {
    byName.set(normalize(member.username), member.id);
    for (const history of member.nameHistory) byName.set(normalize(history.name), member.id);
    if (member.isTempAway && member.tempAwayAllianceTag) {
      tempAwayByTag.set(normalize(member.tempAwayAllianceTag), member.id);
    }
  }

  return rows.map((row, index) => {
    const playerName = String(row.playerName ?? "");
    const allianceTag = typeof row.allianceTag === "string" ? row.allianceTag : "";
    let memberId = byName.get(normalize(playerName)) ?? null;
    if (!memberId && allianceTag && normalize(allianceTag) !== normalize(settings?.tag ?? "")) {
      memberId = tempAwayByTag.get(normalize(allianceTag)) ?? null;
    }
    return { row, rowNumber: index + 1, memberId };
  });
}

export async function computeLeaderboardDiff(leaderboardType: LeaderboardTypeName, rows: UploadRow[]): Promise<DiffEntry[]> {
  const [latest, matched] = await Promise.all([
    prisma.leaderboardSnapshot.findFirst({
      where: { type: leaderboardType },
      orderBy: { capturedAt: "desc" },
      include: { entries: true },
    }),
    matchUploadRows(rows),
  ]);

  const previous = new Map<string, Record<string, unknown>>();
  for (const entry of latest?.entries ?? []) {
    previous.set(normalize(entry.playerName), entry.data as Record<string, unknown>);
  }

  const seen = new Set<string>();
  const diff: DiffEntry[] = [];
  for (const item of matched) {
    const key = normalize(String(item.row.playerName ?? ""));
    seen.add(key);
    if (!item.memberId && leaderboardType !== "ALLIANCE_PLAYER_LIST") {
      diff.push({
        status: "unmatched",
        playerName: String(item.row.playerName ?? ""),
        row: item.rowNumber,
        memberId: null,
      });
    }
    const before = previous.get(key);
    if (!before) {
      diff.push({ status: "new", playerName: String(item.row.playerName ?? ""), newValue: item.row, memberId: item.memberId });
      continue;
    }
    const changedFields = Object.keys(item.row).filter((field) => before[field] !== item.row[field]);
    if (changedFields.length === 0) {
      diff.push({ status: "unchanged", playerName: String(item.row.playerName ?? ""), memberId: item.memberId });
      continue;
    }
    for (const field of changedFields) {
      diff.push({
        status: "changed",
        playerName: String(item.row.playerName ?? ""),
        field,
        oldValue: before[field],
        newValue: item.row[field],
        memberId: item.memberId,
      });
    }
  }

  for (const [key, entry] of previous) {
    if (!seen.has(key)) {
      diff.push({ status: "removed", playerName: String(entry.playerName ?? key), oldValue: entry });
    }
  }

  return diff;
}

export function diffSummary(diff: DiffEntry[]) {
  return {
    newRows: diff.filter((item) => item.status === "new").length,
    changedRows: diff.filter((item) => item.status === "changed").length,
    unchangedRows: diff.filter((item) => item.status === "unchanged").length,
    removedRows: diff.filter((item) => item.status === "removed").length,
    unmatchedRows: diff.filter((item) => item.status === "unmatched").length,
  };
}

export function assertLeaderboardType(value: unknown): LeaderboardTypeName {
  if (typeof value === "string" && LEADERBOARD_TYPES.includes(value as LeaderboardTypeName)) {
    return value as LeaderboardTypeName;
  }
  throw new Error("Invalid leaderboard type");
}

export async function applyLeaderboardSnapshot({
  leaderboardType,
  rows,
  pendingChangeId,
  actorId,
  action,
}: {
  leaderboardType: LeaderboardTypeName;
  rows: UploadRow[];
  pendingChangeId?: string | null;
  actorId: string;
  action: string;
}) {
  const matched = await matchUploadRows(rows);
  const activeSeason =
    leaderboardType === "BATTLE_VANGUARD"
      ? await prisma.season.findFirst({ where: { isActive: true }, select: { id: true } })
      : null;

  return prisma.$transaction(async (tx) => {
    if (leaderboardType === "ALLIANCE_PLAYER_LIST") {
      const now = new Date();
      const membersByName = new Map<string, string>();
      for (const item of matched) {
        if (item.memberId) {
          membersByName.set(normalize(String(item.row.playerName ?? "")), item.memberId);
          continue;
        }

        const playerName = String(item.row.playerName ?? "").trim();
        if (!playerName) continue;

        const key = normalize(playerName);
        const existingMemberId = membersByName.get(key);
        if (existingMemberId) {
          item.memberId = existingMemberId;
          continue;
        }

        const existing = await tx.allianceMember.findFirst({
          where: { username: { equals: playerName, mode: "insensitive" } },
          select: { id: true },
        });
        if (existing) {
          item.memberId = existing.id;
          membersByName.set(key, existing.id);
          continue;
        }

        const created = await tx.allianceMember.create({
          data: {
            username: playerName,
            active: true,
            memberStatus: "ACTIVE",
            currentPower: totalPower(item.row.totalPower),
            currentRank: allianceRank(item.row.allianceRank),
            lastRosterImportedAt: now,
            joinedAt: now,
          },
          select: { id: true },
        });
        item.memberId = created.id;
        membersByName.set(key, created.id);
      }
    }

    const snapshot = await tx.leaderboardSnapshot.create({
      data: {
        type: leaderboardType as LeaderboardType,
        changeRequestId: pendingChangeId ?? null,
        seasonId: activeSeason?.id ?? null,
        entries: {
          create: matched.map((item) => ({
            memberId: item.memberId,
            rank: typeof item.row.rank === "number" ? item.row.rank : null,
            playerName: String(item.row.playerName),
            data: item.row as never,
          })),
        },
      },
      include: { entries: true },
    });

    if (leaderboardType === "ALLIANCE_PLAYER_LIST") {
      const now = new Date();
      for (const item of matched) {
        if (!item.memberId) continue;
        const rankValue = allianceRank(item.row.allianceRank);
        const powerValue = totalPower(item.row.totalPower);
        await tx.allianceMember.update({
          where: { id: item.memberId },
          data: {
            ...(powerValue !== undefined && { currentPower: powerValue }),
            ...(rankValue !== undefined && { currentRank: rankValue }),
            lastRosterImportedAt: now,
          },
        });
      }
    }

    await createAuditLog(
      actorId,
      action,
      "LeaderboardSnapshot",
      snapshot.id,
      undefined,
      pickSnapshot(jsonSafe(snapshot)),
      tx,
    );

    return snapshot;
  }, { timeout: 30_000 });
}

export async function parsePendingRows(pendingChangeId: string) {
  const pending = await prisma.pendingChange.findUnique({ where: { id: pendingChangeId } });
  if (!pending) throw new Error("Upload request not found");
  if (
    pending.type !== "LEADERBOARD_SNAPSHOT" &&
    pending.type !== "ALLIANCE_DUEL_DAY" &&
    pending.type !== "RESERVOIR_RAID_RESULTS"
  ) {
    return { pending, leaderboardType: null, rows: [] };
  }
  const leaderboardType = pending.leaderboardType ? assertLeaderboardType(pending.leaderboardType) : null;
  const validation = validateRows(pending.type as UploadKind, leaderboardType, pending.payload);
  if (validation.errors.length > 0) throw new Error("Stored upload payload is invalid");
  return { pending, leaderboardType, rows: validation.rows };
}
