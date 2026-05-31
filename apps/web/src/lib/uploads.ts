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
  status: "new" | "changed" | "unchanged" | "removed" | "unmatched" | "duplicate" | "resolved";
  playerName: string;
  field?: string;
  oldValue?: unknown;
  newValue?: unknown;
  row?: number;
  memberId?: string | null;
};

export type RowResolution =
  | { action: "assign"; memberId: string }
  | { action: "renameMember"; memberId: string; name: string }
  | { action: "editRow"; name: string }
  | { action: "createPartial" }
  | { action: "remove" };

export type RosterAbsentResolution = "keep" | "inactive" | "transferred";

export type UploadResolutionData = {
  rows?: Record<string, RowResolution>;
  absentMembers?: Record<string, RosterAbsentResolution>;
};

export type UploadOutlier = {
  id: string;
  type: "unmatched" | "duplicate" | "absentMember";
  row?: number;
  playerName: string;
  memberId?: string | null;
  memberName?: string;
  blocking: boolean;
  resolution?: RowResolution | RosterAbsentResolution;
};

export type UploadReview = {
  diff: DiffEntry[];
  summary: ReturnType<typeof diffSummary> & { outliers: number; unresolvedOutliers: number };
  outliers: UploadOutlier[];
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

export function rowSide(row: UploadRow): "ALLY" | "ENEMY" {
  return row.side === "ENEMY" ? "ENEMY" : "ALLY";
}

function rowName(row: UploadRow) {
  return String(row.playerName ?? "").trim();
}

function rowKey(rowNumber: number) {
  return String(rowNumber);
}

function cleanResolutionData(value: unknown): UploadResolutionData {
  if (!isRecord(value)) return {};
  const rows = isRecord(value.rows) ? value.rows : undefined;
  const absentMembers = isRecord(value.absentMembers) ? value.absentMembers : undefined;
  return {
    rows: rows as UploadResolutionData["rows"],
    absentMembers: absentMembers as UploadResolutionData["absentMembers"],
  };
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
    if (kind === "ALLIANCE_DUEL_DAY") {
      const side = item.side;
      if (typeof row.points === "number" && (row.points < 0 || !Number.isInteger(row.points))) {
        errors.push({ code: "number", row: rowNumber, field: "points" });
      }
      if (side === undefined || side === null || side === "") {
        row.side = "ALLY";
      } else if (side === "ALLY" || side === "ENEMY") {
        row.side = side;
      } else {
        errors.push({ code: "string", row: rowNumber, field: "side" });
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

  if (target.kind === "RESERVOIR_RAID_SCORES") {
    return prisma.pendingChange.findFirst({
      where: { status: "PENDING", type: "RESERVOIR_RAID_SCORES" },
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

function applyRowOnlyResolutions(rows: UploadRow[], resolutionData?: UploadResolutionData) {
  const resolutions = resolutionData?.rows ?? {};
  return rows.flatMap((row, index): { row: UploadRow; originalRowNumber: number }[] => {
    const resolution = resolutions[rowKey(index + 1)];
    if (resolution?.action === "remove") return [];
    if (resolution?.action === "editRow") return [{ row: { ...row, playerName: resolution.name.trim() }, originalRowNumber: index + 1 }];
    return [{ row: { ...row }, originalRowNumber: index + 1 }];
  });
}

export async function computeUploadReview({
  kind,
  leaderboardType,
  rows,
  resolutionData,
}: {
  kind: UploadKind;
  leaderboardType?: LeaderboardTypeName | null;
  rows: UploadRow[];
  resolutionData?: UploadResolutionData | null;
}): Promise<UploadReview> {
  const cleanResolutions = cleanResolutionData(resolutionData);
  const preparedRows = applyRowOnlyResolutions(rows, cleanResolutions);
  const reviewRows = preparedRows.map((item) => item.row);
  const diff =
    kind === "LEADERBOARD_SNAPSHOT" && leaderboardType
      ? await computeLeaderboardDiff(leaderboardType, reviewRows)
      : (await matchUploadRows(reviewRows)).flatMap((item) => [
          ...(!item.memberId && rowSide(item.row) === "ALLY" && kind !== "RESERVOIR_RAID_RESULTS" && kind !== "RESERVOIR_RAID_SCORES"
            ? [{
                status: "unmatched" as const,
                playerName: rowName(item.row),
                row: item.rowNumber,
                memberId: null,
              }]
            : []),
          {
            status: "new" as const,
            playerName: rowName(item.row),
            newValue: item.row,
            memberId: item.memberId,
          },
        ]);

  const matched = await matchUploadRows(reviewRows);
  const outliers: UploadOutlier[] = [];
  const seenRows = new Map<string, number[]>();
  const seenMembers = new Map<string, number[]>();
  const rowByOriginalNumber = new Map<number, UploadRow>();

  matched.forEach((item, index) => {
    const originalRowNumber = preparedRows[index]?.originalRowNumber ?? item.rowNumber;
    rowByOriginalNumber.set(originalRowNumber, item.row);
    const name = rowName(item.row);
    const side = rowSide(item.row);
    const duplicateKey = kind === "ALLIANCE_DUEL_DAY" ? `${side}:${normalize(name)}` : normalize(name);
    const existing = seenRows.get(duplicateKey) ?? [];
    existing.push(originalRowNumber);
    seenRows.set(duplicateKey, existing);
    if (side === "ALLY" && item.memberId) {
      const existingMemberRows = seenMembers.get(item.memberId) ?? [];
      existingMemberRows.push(originalRowNumber);
      seenMembers.set(item.memberId, existingMemberRows);
    }

    const resolution = cleanResolutions.rows?.[rowKey(originalRowNumber)];
    const resolved =
      resolution?.action === "assign" ||
      resolution?.action === "renameMember" ||
      resolution?.action === "createPartial" ||
      resolution?.action === "remove";
    if (!item.memberId && side === "ALLY" && !resolved && kind !== "RESERVOIR_RAID_RESULTS" && kind !== "RESERVOIR_RAID_SCORES") {
      outliers.push({
        id: `row-${item.rowNumber}-unmatched`,
        type: "unmatched",
        row: originalRowNumber,
        playerName: name,
        memberId: null,
        blocking: true,
      });
    } else if (!item.memberId && side === "ALLY" && resolved && kind !== "RESERVOIR_RAID_RESULTS" && kind !== "RESERVOIR_RAID_SCORES") {
      outliers.push({
        id: `row-${item.rowNumber}-resolved`,
        type: "unmatched",
        row: originalRowNumber,
        playerName: name,
        memberId: null,
        blocking: false,
        resolution,
      });
    }
  });

  for (const rowNumbers of seenRows.values()) {
    if (rowNumbers.length < 2) continue;
    for (const duplicateRow of rowNumbers) {
      const resolution = cleanResolutions.rows?.[rowKey(duplicateRow)];
      if (resolution?.action === "remove") continue;
      const row = rowByOriginalNumber.get(duplicateRow);
      outliers.push({
        id: `row-${duplicateRow}-duplicate`,
        type: "duplicate",
        row: duplicateRow,
        playerName: row ? rowName(row) : "",
        blocking: true,
      });
    }
  }

  for (const rowNumbers of seenMembers.values()) {
    if (rowNumbers.length < 2) continue;
    for (const duplicateRow of rowNumbers) {
      const resolution = cleanResolutions.rows?.[rowKey(duplicateRow)];
      if (resolution?.action === "remove") continue;
      const row = rowByOriginalNumber.get(duplicateRow);
      outliers.push({
        id: `row-${duplicateRow}-duplicate-member`,
        type: "duplicate",
        row: duplicateRow,
        playerName: row ? rowName(row) : "",
        blocking: true,
      });
    }
  }

  if (kind === "LEADERBOARD_SNAPSHOT" && leaderboardType === "ALLIANCE_PLAYER_LIST") {
    const uploadedMemberIds = new Set(matched.map((item) => item.memberId).filter(Boolean));
    const currentMembers = await prisma.allianceMember.findMany({
      where: { memberStatus: { notIn: ["LEFT", "TRANSFERRED"] } },
      select: { id: true, username: true },
      orderBy: { username: "asc" },
    });
    for (const member of currentMembers) {
      for (const item of matched) {
        const originalRowNumber = preparedRows[item.rowNumber - 1]?.originalRowNumber ?? item.rowNumber;
        const resolution = cleanResolutions.rows?.[rowKey(originalRowNumber)];
        if ((resolution?.action === "assign" || resolution?.action === "renameMember") && resolution.memberId === member.id) {
          uploadedMemberIds.add(member.id);
        }
      }
      if (uploadedMemberIds.has(member.id)) continue;
      const resolution = cleanResolutions.absentMembers?.[member.id];
      outliers.push({
        id: `absent-${member.id}`,
        type: "absentMember",
        playerName: member.username,
        memberId: member.id,
        memberName: member.username,
        blocking: !resolution,
        resolution,
      });
    }
  }

  const baseSummary = diffSummary(diff);
  return {
    diff,
    outliers,
    summary: {
      ...baseSummary,
      outliers: outliers.length,
      unresolvedOutliers: outliers.filter((item) => item.blocking).length,
    },
  };
}

export async function resolveRowsForApply({
  rows,
  resolutionData,
  tx,
}: {
  rows: UploadRow[];
  resolutionData?: UploadResolutionData | null;
  tx: typeof prisma;
}) {
  const cleanResolutions = cleanResolutionData(resolutionData);
  const prepared: { row: UploadRow; originalRowNumber: number; resolution?: RowResolution }[] = [];
  rows.forEach((row, index) => {
    const resolution = cleanResolutions.rows?.[rowKey(index + 1)];
    if (resolution?.action === "remove") return;
    if (resolution?.action === "editRow") {
      prepared.push({ row: { ...row, playerName: resolution.name.trim() }, originalRowNumber: index + 1, resolution });
      return;
    }
    prepared.push({ row: { ...row }, originalRowNumber: index + 1, resolution });
  });
  const matched = await matchUploadRows(prepared.map((item) => item.row));

  for (const [index, item] of prepared.entries()) {
    const match = matched[index];
    const resolution = item.resolution;
    if (resolution?.action === "assign") {
      match.memberId = resolution.memberId;
    } else if (resolution?.action === "renameMember") {
      const member = await tx.allianceMember.findUnique({ where: { id: resolution.memberId }, select: { username: true } });
      if (member && normalize(member.username) !== normalize(resolution.name)) {
        await tx.memberNameHistory.create({ data: { memberId: resolution.memberId, name: member.username } });
        await tx.allianceMember.update({ where: { id: resolution.memberId }, data: { username: resolution.name.trim(), isPartial: false } });
      }
      match.memberId = resolution.memberId;
      item.row.playerName = resolution.name.trim();
    } else if (resolution?.action === "createPartial") {
      const created = await tx.allianceMember.create({
        data: {
          username: rowName(item.row),
          active: true,
          isPartial: true,
          memberStatus: "ACTIVE",
          currentPower: totalPower(item.row.totalPower),
          currentRank: allianceRank(item.row.allianceRank),
          joinedAt: new Date(),
          lastRosterImportedAt: new Date(),
        },
        select: { id: true },
      });
      match.memberId = created.id;
    }
  }

  return matched.map((item, index) => ({ ...item, row: prepared[index].row, rowNumber: prepared[index].originalRowNumber }));
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
  resolutionData,
  pendingChangeId,
  actorId,
  action,
}: {
  leaderboardType: LeaderboardTypeName;
  rows: UploadRow[];
  resolutionData?: UploadResolutionData | null;
  pendingChangeId?: string | null;
  actorId: string;
  action: string;
}) {
  const activeSeason =
    leaderboardType === "BATTLE_VANGUARD"
      ? await prisma.season.findFirst({ where: { isActive: true }, select: { id: true } })
      : null;

  return prisma.$transaction(async (tx) => {
    const matched = await resolveRowsForApply({ rows, resolutionData, tx: tx as typeof prisma });
    const unresolved = matched.filter((item) => rowSide(item.row) === "ALLY" && !item.memberId);
    if (unresolved.length > 0) {
      const error = new Error("Unresolved upload rows");
      error.name = "UNRESOLVED_UPLOAD_OUTLIERS";
      throw error;
    }

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
            active: true,
            memberStatus: "ACTIVE",
            isPartial: false,
            ...(powerValue !== undefined && { currentPower: powerValue }),
            ...(rankValue !== undefined && { currentRank: rankValue }),
            lastRosterImportedAt: now,
          },
        });
      }

      const resolutions = cleanResolutionData(resolutionData);
      for (const [memberId, decision] of Object.entries(resolutions.absentMembers ?? {})) {
        if (decision === "keep") continue;
        await tx.allianceMember.update({
          where: { id: memberId },
          data: {
            active: false,
            memberStatus: decision === "transferred" ? "TRANSFERRED" : "LEFT",
            leftAt: now,
            isTempAway: false,
            tempAwayAllianceTag: null,
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
    pending.type !== "RESERVOIR_RAID_RESULTS" &&
    pending.type !== "RESERVOIR_RAID_SCORES"
  ) {
    return { pending, leaderboardType: null, rows: [] };
  }
  const leaderboardType = pending.leaderboardType ? assertLeaderboardType(pending.leaderboardType) : null;
  const validation = validateRows(pending.type as UploadKind, leaderboardType, pending.payload);
  if (validation.errors.length > 0) throw new Error("Stored upload payload is invalid");
  return { pending, leaderboardType, rows: validation.rows };
}
