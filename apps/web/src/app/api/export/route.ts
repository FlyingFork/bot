import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getTranslations } from "next-intl/server";
import { prisma } from "@tiles-survive/database";
import { apiError, requireUser } from "@/lib/server-auth";
import { hasRole } from "@/lib/roles";
import { formatPowerFull } from "@/lib/power";
import {
  LEADERBOARD_EXPORT_FIELDS,
  displayEntryValue,
  isPhase4LeaderboardType,
} from "@/lib/phase4-shared";
import { getContributionScores, latestPowerFromEntryData } from "@/lib/phase4";
import { totalSquadPower } from "@/lib/phase6";
import {
  computePoolMaxValues,
  participantCompositeScore,
  type RaidParticipantLike,
} from "@/lib/raid-assignment";

type ExportRow = Record<string, string | number | null>;

function csvEscape(value: string | number | null) {
  const text = value === null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function csvResponse(filename: string, headers: string[], rows: ExportRow[]) {
  const body = "\uFEFF" + [headers.map(csvEscape).join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header] ?? "")).join(","))].join("\r\n");
  return new NextResponse(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}.csv"`,
    },
  });
}

async function xlsxResponse(filename: string, headers: string[], rows: ExportRow[]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Export");
  sheet.addRow(headers);
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2D4A7A" } };
  rows.forEach((row) => sheet.addRow(headers.map((header) => row[header] ?? "")));
  sheet.columns.forEach((column) => {
    let max = 10;
    column.eachCell?.((cell) => {
      max = Math.max(max, String(cell.value ?? "").length + 2);
    });
    column.width = Math.min(max, 48);
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${filename}.xlsx"`,
    },
  });
}

async function memberListRows() {
  const members = await prisma.allianceMember.findMany({ orderBy: { username: "asc" } });
  return members.map((member) => ({
    username: member.username,
    rank: member.currentRank,
    status: member.memberStatus,
    power: member.currentPower ? formatPowerFull(member.currentPower) : null,
    joinedAt: member.joinedAt?.toISOString().slice(0, 10) ?? null,
  }));
}

async function statsMemberRows() {
  const members = await prisma.allianceMember.findMany({
    where: { memberStatus: { notIn: ["LEFT", "TRANSFERRED"] } },
    orderBy: { username: "asc" },
  });
  const scores = await getContributionScores(members.map((member) => member.id));
  return members.map((member) => ({
    username: member.username,
    rank: member.currentRank,
    status: member.memberStatus,
    power: member.currentPower ? formatPowerFull(member.currentPower) : null,
    contributionScore: scores.get(member.id)?.score ?? 50,
  }));
}

async function leaderboardRows(snapshotId: string | null) {
  if (!snapshotId) return { rows: [], fields: ["rank", "playerName"] };
  const snapshot = await prisma.leaderboardSnapshot.findUnique({
    where: { id: snapshotId },
    include: { entries: { orderBy: [{ rank: "asc" }, { playerName: "asc" }] } },
  });
  if (!snapshot || !isPhase4LeaderboardType(snapshot.type)) return { rows: [], fields: ["rank", "playerName"] };
  const fields = LEADERBOARD_EXPORT_FIELDS[snapshot.type];
  return {
    fields,
    rows: snapshot.entries.map((entry) => {
      const data = entry.data as Record<string, unknown>;
      return Object.fromEntries(
        fields.map((field) => [
          field,
          field === "rank" ? entry.rank : field === "playerName" ? entry.playerName : displayEntryValue(data[field]),
        ]),
      ) as ExportRow;
    }),
  };
}

async function memberPowerRows(memberId: string | null) {
  if (!memberId) return [];
  const rows = await prisma.leaderboardEntry.findMany({
    where: { memberId, snapshot: { type: { in: ["SOLO_POWER", "ALLIANCE_PLAYER_LIST"] } } },
    include: { snapshot: { select: { capturedAt: true, type: true } } },
    orderBy: { snapshot: { capturedAt: "asc" } },
  });
  return rows.map((row) => ({
    date: row.snapshot.capturedAt.toISOString(),
    type: row.snapshot.type,
    power: latestPowerFromEntryData(row.data),
  }));
}

async function memberRankRows(memberId: string | null) {
  if (!memberId) return [];
  const rows = await prisma.leaderboardEntry.findMany({
    where: { memberId, rank: { not: null } },
    include: { snapshot: { select: { capturedAt: true, type: true } } },
    orderBy: { snapshot: { capturedAt: "asc" } },
  });
  return rows.map((row) => ({
    date: row.snapshot.capturedAt.toISOString(),
    type: row.snapshot.type,
    rank: row.rank,
  }));
}

async function memberDuelRows(memberId: string | null) {
  if (!memberId) return [];
  const instances = await prisma.allianceDuelInstance.findMany({
    where: { days: { some: { scores: { some: { memberId } } } } },
    orderBy: { startDate: "desc" },
    include: { days: { orderBy: { dayNumber: "asc" }, include: { scores: { where: { memberId } } } } },
  });
  return instances.map((instance) => {
    const days = [1, 2, 3, 4, 5, 6].map((dayNumber) => {
      const day = instance.days.find((item) => item.dayNumber === dayNumber);
      return day?.scores[0]?.points !== undefined ? Number(day.scores[0].points) : null;
    });
    return {
      week: instance.startDate.toISOString().slice(0, 10),
      opponent: instance.opponentName ?? instance.opponentTag ?? "",
      day1: days[0],
      day2: days[1],
      day3: days[2],
      day4: days[3],
      day5: days[4],
      day6: days[5],
      total: days.reduce<number>((sum, value) => sum + (value ?? 0), 0),
      outcome: instance.outcome,
    };
  });
}

async function memberRaidRows(memberId: string | null) {
  if (!memberId) return [];
  const rows = await prisma.reservoirRaidParticipant.findMany({
    where: { memberId },
    orderBy: { plan: { raidDate: "desc" } },
    include: { plan: { select: { raidDate: true } } },
  });
  return rows.map((row) => ({
    date: row.plan.raidDate.toISOString().slice(0, 10),
    status: row.registrationStatus,
    waterCollected: row.waterCollected,
  }));
}

async function rrsLeaderboardRows() {
  const members = await prisma.allianceMember.findMany({
    where: { memberStatus: { notIn: ["LEFT", "TRANSFERRED"] } },
    select: { username: true, reservoirRaidScore: true },
    orderBy: { username: "asc" },
  });
  return [...members]
    .sort((a, b) => {
      if (a.reservoirRaidScore !== null && b.reservoirRaidScore !== null) return b.reservoirRaidScore - a.reservoirRaidScore;
      if (a.reservoirRaidScore !== null) return -1;
      if (b.reservoirRaidScore !== null) return 1;
      return a.username.localeCompare(b.username);
    })
    .map((m) => ({ username: m.username, reservoirRaidScore: m.reservoirRaidScore }));
}

async function raidParticipantRows(planId: string | null): Promise<ExportRow[]> {
  if (!planId) return [];
  const plan = await prisma.reservoirRaidPlan.findUnique({
    where: { id: planId },
    include: {
      participants: {
        orderBy: { createdAt: "asc" },
        include: {
          member: { select: { username: true, reservoirRaidScore: true } },
          squadPowers: { orderBy: { squadIndex: "asc" } },
        },
      },
    },
  });
  if (!plan) return [];

  const participantLike: RaidParticipantLike[] = plan.participants.map((p) => ({
    id: p.id,
    username: p.member?.username ?? p.username,
    registrationStatus: p.registrationStatus,
    squad1Power: Number(p.squadPowers.find((sq) => sq.squadIndex === 1)?.power ?? 0),
    totalSquadPower: totalSquadPower(p.squadPowers),
    reservoirRaidScore: p.member?.reservoirRaidScore ?? null,
  }));
  const { maxRRS, maxSquad1 } = computePoolMaxValues(participantLike);

  const matchedMemberIds = plan.participants.map((p) => p.memberId).filter((mid): mid is string => mid !== null);
  const [contributionScores, waterHistory] = await Promise.all([
    matchedMemberIds.length > 0 ? getContributionScores(matchedMemberIds) : Promise.resolve(new Map()),
    matchedMemberIds.length > 0
      ? prisma.reservoirRaidParticipant.findMany({
          where: { memberId: { in: matchedMemberIds }, waterCollected: { not: null } },
          select: { memberId: true, waterCollected: true },
          orderBy: { plan: { raidDate: "desc" } },
        })
      : Promise.resolve([]),
  ]);

  const waterByMember = new Map<string, { last: number; total: number }>();
  for (const entry of waterHistory) {
    if (!entry.memberId || entry.waterCollected === null) continue;
    const existing = waterByMember.get(entry.memberId);
    if (!existing) {
      waterByMember.set(entry.memberId, { last: entry.waterCollected, total: entry.waterCollected });
    } else {
      existing.total += entry.waterCollected;
    }
  }

  const statusOrder: Record<string, number> = {
    SELECTED_PARTICIPANT: 0, SELECTED_RESERVIST: 1, MATCHED: 2, NOT_SELECTED: 3, UNMATCHED: 4,
  };

  const sorted = [...plan.participants].sort((a, b) => {
    const sa = statusOrder[a.registrationStatus] ?? 5;
    const sb = statusOrder[b.registrationStatus] ?? 5;
    if (sa !== sb) return sa - sb;
    const pLikeA = participantLike.find((p) => p.id === a.id)!;
    const pLikeB = participantLike.find((p) => p.id === b.id)!;
    return participantCompositeScore(pLikeB, maxRRS, maxSquad1) - participantCompositeScore(pLikeA, maxRRS, maxSquad1);
  });

  return sorted.map((p) => {
    const pLike = participantLike.find((pl) => pl.id === p.id)!;
    const cs = participantCompositeScore(pLike, maxRRS, maxSquad1);
    const wd = p.memberId ? waterByMember.get(p.memberId) : undefined;
    const contrib = p.memberId ? contributionScores.get(p.memberId) : undefined;
    return {
      username: p.member?.username ?? p.username,
      status: p.registrationStatus,
      squad1Power: pLike.squad1Power || null,
      totalSquadPower: pLike.totalSquadPower || null,
      reservoirRaidScore: p.member?.reservoirRaidScore ?? null,
      compositeScore: Math.round(cs * 10) / 10,
      raidReliability: contrib && contrib.raidTotal > 0 ? contrib.raidScore : null,
      waterCollected: p.waterCollected,
      lastWaterCollected: wd?.last ?? null,
      totalWaterCollected: wd?.total ?? null,
    };
  });
}

async function raidResultRows(planId: string | null): Promise<ExportRow[]> {
  if (!planId) return [];
  const participants = await prisma.reservoirRaidParticipant.findMany({
    where: { planId },
    orderBy: [{ waterCollected: "desc" }],
    include: { member: { select: { username: true } } },
  });
  return participants.map((p) => ({
    playerName: p.member?.username ?? p.username,
    waterCollected: p.waterCollected,
  }));
}

async function allianceDuelSummaryRows(instanceId: string | null) {
  if (!instanceId) return [];
  const instance = await prisma.allianceDuelInstance.findUnique({
    where: { id: instanceId },
    include: {
      days: {
        orderBy: { dayNumber: "asc" },
        include: { scores: { include: { member: { select: { username: true } } } } },
      },
    },
  });
  if (!instance) return [];
  const totals = new Map<string, ExportRow>();
  for (const day of instance.days) {
    for (const score of day.scores) {
      const playerName = score.member?.username ?? score.playerName;
      const key = `${score.side}:${playerName}`;
      const points = Number(score.points);
      const row = totals.get(key) ?? {
        playerName,
        side: score.side,
        day1: null,
        day2: null,
        day3: null,
        day4: null,
        day5: null,
        day6: null,
        total: 0,
      };
      row[`day${day.dayNumber}`] = points;
      row.total = Number(row.total ?? 0) + points;
      totals.set(key, row);
    }
  }
  return [...totals.values()].sort((a, b) => Number(b.total ?? 0) - Number(a.total ?? 0));
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const params = request.nextUrl.searchParams;
    const type = params.get("type") ?? "";
    const format = params.get("format") === "xlsx" ? "xlsx" : "csv";
    const t = await getTranslations("phase4.fields");
    const memberId = params.get("memberId");
    if (type.startsWith("member-") && !hasRole(user.role, "r4") && memberId !== user.allianceMemberId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    let rows: ExportRow[] = [];
    let fields: string[] = [];

    if (type === "member-list") {
      if (!hasRole(user.role, "r4")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      rows = await memberListRows();
      fields = ["username", "rank", "status", "power", "joinedAt"];
    } else if (type === "stats-members") {
      if (!hasRole(user.role, "r4")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      rows = await statsMemberRows();
      fields = ["username", "rank", "status", "power", "contributionScore"];
    } else if (type === "leaderboard-snapshot") {
      if (!hasRole(user.role, "r4")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      const result = await leaderboardRows(params.get("snapshotId"));
      rows = result.rows;
      fields = result.fields;
    } else if (type === "member-power-history") {
      rows = await memberPowerRows(memberId);
      fields = ["date", "type", "power"];
    } else if (type === "member-rank-history") {
      rows = await memberRankRows(memberId);
      fields = ["date", "type", "rank"];
    } else if (type === "member-duel-history") {
      rows = await memberDuelRows(memberId);
      fields = ["week", "opponent", "day1", "day2", "day3", "day4", "day5", "day6", "total", "outcome"];
    } else if (type === "member-raid-history") {
      rows = await memberRaidRows(memberId);
      fields = ["date", "status", "waterCollected"];
    } else if (type === "alliance-duel-summary") {
      if (!hasRole(user.role, "r4")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      rows = await allianceDuelSummaryRows(params.get("instanceId"));
      fields = ["playerName", "day1", "day2", "day3", "day4", "day5", "day6", "total"];
    } else if (type === "raid-results") {
      if (!hasRole(user.role, "r4")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      const planId = params.get("planId");
      rows = await raidResultRows(planId);
      fields = ["playerName", "waterCollected"];
    } else if (type === "rrs-leaderboard") {
      if (!hasRole(user.role, "r4")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      rows = await rrsLeaderboardRows();
      fields = ["username", "reservoirRaidScore"];
    } else if (type === "raid-participants") {
      if (!hasRole(user.role, "r4")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      rows = await raidParticipantRows(params.get("planId"));
      fields = ["username", "status", "squad1Power", "totalSquadPower", "reservoirRaidScore", "compositeScore", "raidReliability", "waterCollected", "lastWaterCollected", "totalWaterCollected"];
    } else {
      return NextResponse.json({ error: "Invalid export type" }, { status: 400 });
    }

    const headers = fields.map((field) => t(field));
    const translatedRows = rows.map((row) =>
      Object.fromEntries(fields.map((field, index) => [headers[index], row[field] ?? null])),
    );
    const filename = `tiles-${type}`;
    return format === "xlsx"
      ? xlsxResponse(filename, headers, translatedRows)
      : csvResponse(filename, headers, translatedRows);
  } catch (error) {
    return apiError(error);
  }
}
