import { NextRequest, NextResponse } from "next/server";
import { apiError, requireAdmin } from "@/lib/server-auth";
import { applyLeaderboardSnapshot, assertLeaderboardType, validateRows } from "@/lib/uploads";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin();
    const body = (await request.json()) as { leaderboardType?: string | null; json?: string };
    const leaderboardType = assertLeaderboardType(body.leaderboardType);
    const validation = validateRows("LEADERBOARD_SNAPSHOT", leaderboardType, body.json ?? "");
    if (validation.errors.length > 0) {
      return NextResponse.json({ errors: validation.errors }, { status: 400 });
    }
    const snapshot = await applyLeaderboardSnapshot({
      leaderboardType,
      rows: validation.rows,
      actorId: user.id,
      action: "DATA_ENTERED_DIRECTLY",
    });
    return NextResponse.json({ ok: true, snapshotId: snapshot.id });
  } catch (error) {
    return apiError(error);
  }
}
