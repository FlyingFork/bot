import { NextRequest, NextResponse } from "next/server";
import { apiError, requireMinRole } from "@/lib/server-auth";
import {
  assertLeaderboardType,
  computeLeaderboardDiff,
  diffSummary,
  matchUploadRows,
  validateRows,
  type DiffEntry,
} from "@/lib/uploads";
import type { UploadKind } from "@/lib/upload-schemas";

export async function POST(request: NextRequest) {
  try {
    await requireMinRole("r4");
    const body = (await request.json()) as {
      kind?: UploadKind;
      leaderboardType?: string | null;
      json?: string;
    };

    const kind = body.kind;
    if (kind !== "LEADERBOARD_SNAPSHOT" && kind !== "ALLIANCE_DUEL_DAY" && kind !== "RESERVOIR_RAID_RESULTS") {
      return NextResponse.json({ errors: [{ code: "type" }], rows: [], diff: [] }, { status: 400 });
    }

    const leaderboardType = kind === "LEADERBOARD_SNAPSHOT" ? assertLeaderboardType(body.leaderboardType) : null;
    const validation = validateRows(kind, leaderboardType, body.json ?? "");
    if (validation.errors.length > 0) {
      return NextResponse.json({ errors: validation.errors, rows: [], diff: [] }, { status: 400 });
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
        {
          status: "new" as const,
          playerName: String(item.row.playerName ?? ""),
          newValue: item.row,
          memberId: item.memberId,
        },
      ]);
    }

    return NextResponse.json({ errors: [], rows: validation.rows, diff, summary: diffSummary(diff) });
  } catch (error) {
    return apiError(error);
  }
}
