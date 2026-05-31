import { NextResponse } from "next/server";
import { prisma } from "@tiles-survive/database";
import { createAuditLog } from "@/lib/audit";
import { jsonSafe, pickSnapshot } from "@/lib/json";
import { createNotification } from "@/lib/notifications";
import { apiError, requireAdmin } from "@/lib/server-auth";
import { applyLeaderboardSnapshot, computeUploadReview, parsePendingRows, type UploadResolutionData } from "@/lib/uploads";
import { applyAllianceDuelDayUpload } from "@/lib/phase5";
import { applyRaidResultsUpload, applyRaidScoresUpload } from "@/lib/phase6";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Params) {
  try {
    const actor = await requireAdmin();
    const { id } = await context.params;
    const { pending, leaderboardType, rows } = await parsePendingRows(id);
    if (pending.status !== "PENDING") {
      return NextResponse.json({ errorCode: "notPending" }, { status: 400 });
    }
    if (
      pending.type !== "LEADERBOARD_SNAPSHOT" &&
      pending.type !== "ALLIANCE_DUEL_DAY" &&
      pending.type !== "RESERVOIR_RAID_RESULTS" &&
      pending.type !== "RESERVOIR_RAID_SCORES"
    ) {
      return NextResponse.json({ errorCode: "laterPhase" }, { status: 400 });
    }
    const resolutionData = pending.resolutionData as UploadResolutionData | null;
    const review = await computeUploadReview({
      kind: pending.type,
      leaderboardType,
      rows,
      resolutionData,
    });
    if (review.summary.unresolvedOutliers > 0) {
      return NextResponse.json({ errorCode: "unresolvedOutliers", outliers: review.outliers }, { status: 400 });
    }
    if (pending.type === "LEADERBOARD_SNAPSHOT" && leaderboardType) {
      await applyLeaderboardSnapshot({
        leaderboardType,
        rows,
        resolutionData,
        pendingChangeId: pending.id,
        actorId: actor.id,
        action: "UPLOAD_DATA_APPLIED",
      });
    } else if (pending.type === "ALLIANCE_DUEL_DAY" && pending.eventInstanceId && pending.eventDay) {
      try {
        await applyAllianceDuelDayUpload({
          instanceId: pending.eventInstanceId,
          dayNumber: pending.eventDay,
          rows,
          resolutionData,
          pendingChangeId: pending.id,
          actorId: actor.id,
          action: "UPLOAD_DATA_APPLIED",
        });
      } catch (error) {
        if (error instanceof Error && error.name === "UNMATCHED_DUEL_ROWS") {
          return NextResponse.json({ errorCode: "unmatchedRows" }, { status: 400 });
        }
        throw error;
      }
    } else if (pending.type === "RESERVOIR_RAID_RESULTS" && pending.eventInstanceId) {
      await applyRaidResultsUpload({
        planId: pending.eventInstanceId,
        rows,
        pendingChangeId: pending.id,
        actorId: actor.id,
        action: "UPLOAD_DATA_APPLIED",
      });
    } else if (pending.type === "RESERVOIR_RAID_SCORES") {
      await applyRaidScoresUpload({
        rows,
        actorId: actor.id,
        action: "UPLOAD_DATA_APPLIED",
      });
    } else {
      return NextResponse.json({ errorCode: "laterPhase" }, { status: 400 });
    }

    const updated = await prisma.pendingChange.update({
      where: { id },
        data: {
          status: "APPROVED",
          reviewerId: actor.id,
          reviewedAt: new Date(),
          diffData: { items: review.diff, summary: review.summary, outliers: review.outliers } as never,
        },
      include: { submitter: { select: { id: true } } },
    });

    await createAuditLog(
      actor.id,
      "UPLOAD_APPROVED",
      "PendingChange",
      id,
      pickSnapshot(pending),
      pickSnapshot(jsonSafe(updated)),
    );
    await createNotification(updated.submitter.id, "UPLOAD_APPROVED", "uploadApproved", {
      uploadType: leaderboardType ?? pending.type,
    }, { pendingChangeId: id });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
