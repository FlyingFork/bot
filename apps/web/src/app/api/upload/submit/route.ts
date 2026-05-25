import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@tiles-survive/database";
import { apiError, requireMinRole } from "@/lib/server-auth";
import { notifyAllAdmins } from "@/lib/notifications";
import { applyAllianceDuelDayUpload, canUploadDuelDay } from "@/lib/phase5";
import {
  assertLeaderboardType,
  computeLeaderboardDiff,
  diffSummary,
  hasPendingUpload,
  matchUploadRows,
  validateRows,
  type DiffEntry,
  type UploadTarget,
} from "@/lib/uploads";
import type { UploadKind } from "@/lib/upload-schemas";

export async function POST(request: NextRequest) {
  try {
    const user = await requireMinRole("r4");
    const body = (await request.json()) as {
      kind?: UploadKind;
      leaderboardType?: string | null;
      eventInstanceId?: string | null;
      eventInstanceType?: string | null;
      eventDay?: number | null;
      json?: string;
      label?: string;
    };
    const kind = body.kind;
    if (kind !== "LEADERBOARD_SNAPSHOT" && kind !== "ALLIANCE_DUEL_DAY" && kind !== "RESERVOIR_RAID_RESULTS") {
      return NextResponse.json({ errorCode: "invalidType" }, { status: 400 });
    }

    const leaderboardType = kind === "LEADERBOARD_SNAPSHOT" ? assertLeaderboardType(body.leaderboardType) : null;
    const target: UploadTarget = {
      kind,
      leaderboardType,
      eventInstanceId: body.eventInstanceId ?? null,
      eventInstanceType: body.eventInstanceType ?? null,
      eventDay: body.eventDay ?? null,
    };
    const pending = await hasPendingUpload(target);
    if (pending) return NextResponse.json({ errorCode: "locked" }, { status: 409 });

    const validation = validateRows(kind, leaderboardType, body.json ?? "");
    if (validation.errors.length > 0) {
      return NextResponse.json({ errors: validation.errors }, { status: 400 });
    }

    if (kind === "ALLIANCE_DUEL_DAY") {
      if (!body.eventInstanceId || !body.eventDay) {
        return NextResponse.json({ errorCode: "invalidTarget" }, { status: 400 });
      }
      const day = await prisma.allianceDuelDay.findUnique({
        where: { instanceId_dayNumber: { instanceId: body.eventInstanceId, dayNumber: body.eventDay } },
        include: { instance: { select: { status: true } } },
      });
      if (!day) return NextResponse.json({ errorCode: "invalidTarget" }, { status: 404 });
      if (!canUploadDuelDay({ role: user.role, status: day.instance.status, dayDate: day.date })) {
        return NextResponse.json({ errorCode: "dayLocked" }, { status: 403 });
      }

      if (user.role === "admin") {
        try {
          await applyAllianceDuelDayUpload({
            instanceId: body.eventInstanceId,
            dayNumber: body.eventDay,
            rows: validation.rows,
            actorId: user.id,
            action: "DATA_ENTERED_DIRECTLY",
          });
        } catch (error) {
          if (error instanceof Error && error.name === "UNMATCHED_DUEL_ROWS") {
            return NextResponse.json({ errorCode: "unmatchedRows" }, { status: 400 });
          }
          throw error;
        }
        return NextResponse.json({ ok: true, applied: true });
      }
    }

    let diff: DiffEntry[];
    if (kind === "LEADERBOARD_SNAPSHOT" && leaderboardType) {
      diff = await computeLeaderboardDiff(leaderboardType, validation.rows);
    } else {
      const matched = await matchUploadRows(validation.rows);
      diff = matched.flatMap((item) => [
        ...(item.memberId
          ? []
          : [{
              status: "unmatched" as const,
              playerName: String(item.row.playerName ?? ""),
              row: item.rowNumber,
              memberId: null,
            }]),
        { status: "new" as const, playerName: String(item.row.playerName ?? ""), newValue: item.row, memberId: item.memberId },
      ]);
    }

    const change = await prisma.pendingChange.create({
      data: {
        type: kind,
        payload: JSON.stringify(validation.rows),
        submitterId: user.id,
        leaderboardType,
        eventInstanceId: body.eventInstanceId ?? null,
        eventInstanceType: body.eventInstanceType ?? (kind === "RESERVOIR_RAID_RESULTS" ? "RESERVOIR_RAID" : null),
        eventDay: body.eventDay ?? null,
        diffData: { items: diff, summary: diffSummary(diff) } as never,
      },
    });

    await notifyAllAdmins(
      "UPLOAD_SUBMITTED",
      "uploadSubmitted",
      {
        submitter: user.username ?? user.name ?? "User",
        uploadType: body.label ?? leaderboardType ?? kind,
      },
      { pendingChangeId: change.id },
    );

    return NextResponse.json({ ok: true, id: change.id });
  } catch (error) {
    return apiError(error);
  }
}
