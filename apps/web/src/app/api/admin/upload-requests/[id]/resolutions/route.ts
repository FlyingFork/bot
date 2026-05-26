import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@tiles-survive/database";
import { createAuditLog } from "@/lib/audit";
import { jsonSafe, pickSnapshot } from "@/lib/json";
import { apiError, requireAdmin } from "@/lib/server-auth";
import {
  computeUploadReview,
  parsePendingRows,
  type UploadResolutionData,
} from "@/lib/uploads";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Params) {
  try {
    const actor = await requireAdmin();
    const { id } = await context.params;
    const body = (await request.json()) as { resolutionData?: UploadResolutionData };
    const { pending, leaderboardType, rows } = await parsePendingRows(id);
    if (pending.status !== "PENDING") {
      return NextResponse.json({ errorCode: "notPending" }, { status: 400 });
    }
    if (
      pending.type !== "LEADERBOARD_SNAPSHOT" &&
      pending.type !== "ALLIANCE_DUEL_DAY" &&
      pending.type !== "RESERVOIR_RAID_RESULTS"
    ) {
      return NextResponse.json({ errorCode: "laterPhase" }, { status: 400 });
    }

    const resolutionData = body.resolutionData ?? {};
    const review = await computeUploadReview({
      kind: pending.type,
      leaderboardType,
      rows,
      resolutionData,
    });
    const updated = await prisma.pendingChange.update({
      where: { id },
      data: {
        resolutionData: resolutionData as never,
        diffData: { items: review.diff, summary: review.summary, outliers: review.outliers } as never,
      },
    });
    await createAuditLog(
      actor.id,
      "UPLOAD_RESOLUTIONS_UPDATED",
      "PendingChange",
      id,
      pickSnapshot(pending),
      pickSnapshot(jsonSafe(updated)),
    );

    return NextResponse.json({ ok: true, review });
  } catch (error) {
    return apiError(error);
  }
}
