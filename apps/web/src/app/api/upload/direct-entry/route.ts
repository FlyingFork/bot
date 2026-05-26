import { NextRequest, NextResponse } from "next/server";
import { apiError, requireAdmin } from "@/lib/server-auth";
import { applyLeaderboardSnapshot, assertLeaderboardType, computeUploadReview, validateRows } from "@/lib/uploads";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin();
    const body = (await request.json()) as { leaderboardType?: string | null; json?: string };
    const leaderboardType = assertLeaderboardType(body.leaderboardType);
    const validation = validateRows("LEADERBOARD_SNAPSHOT", leaderboardType, body.json ?? "");
    if (validation.errors.length > 0) {
      return NextResponse.json({ errors: validation.errors }, { status: 400 });
    }
    const review = await computeUploadReview({ kind: "LEADERBOARD_SNAPSHOT", leaderboardType, rows: validation.rows, resolutionData: {} });
    if (review.summary.unresolvedOutliers > 0) {
      return NextResponse.json({ errorCode: "unresolvedOutliers", outliers: review.outliers }, { status: 400 });
    }
    let snapshot;
    try {
      snapshot = await applyLeaderboardSnapshot({
        leaderboardType,
        rows: validation.rows,
        resolutionData: {},
        actorId: user.id,
        action: "DATA_ENTERED_DIRECTLY",
      });
    } catch (error) {
      if (error instanceof Error && error.name === "UNRESOLVED_UPLOAD_OUTLIERS") {
        return NextResponse.json({ errorCode: "unresolvedOutliers" }, { status: 400 });
      }
      throw error;
    }
    return NextResponse.json({ ok: true, snapshotId: snapshot.id });
  } catch (error) {
    return apiError(error);
  }
}
