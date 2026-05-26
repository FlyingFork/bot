import { NextRequest, NextResponse } from "next/server";
import { apiError, requireMinRole } from "@/lib/server-auth";
import {
  assertLeaderboardType,
  computeUploadReview,
  validateRows,
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

    const review = await computeUploadReview({ kind, leaderboardType, rows: validation.rows });

    return NextResponse.json({ errors: [], rows: validation.rows, diff: review.diff, summary: review.summary, outliers: review.outliers });
  } catch (error) {
    return apiError(error);
  }
}
