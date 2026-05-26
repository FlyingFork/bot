import { NextRequest, NextResponse } from "next/server";
import { apiError, requireAdmin } from "@/lib/server-auth";
import { applyLeaderboardSnapshot, computeUploadReview, parsePendingRows, type UploadResolutionData } from "@/lib/uploads";
import { prisma } from "@tiles-survive/database";
import { createAuditLog } from "@/lib/audit";
import { jsonSafe, pickSnapshot } from "@/lib/json";
import { createNotification } from "@/lib/notifications";
import { applyAllianceDuelDayUpload } from "@/lib/phase5";

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAdmin();
    const body = (await request.json()) as { ids?: string[] };
    const ids = Array.isArray(body.ids) ? body.ids : [];
    const results: { id: string; ok: boolean; errorCode?: string }[] = [];

    for (const id of ids) {
      const { pending, leaderboardType, rows } = await parsePendingRows(id);
      if (pending.status !== "PENDING") {
        results.push({ id, ok: false, errorCode: "notPending" });
        continue;
      }
      if (pending.type !== "LEADERBOARD_SNAPSHOT" && pending.type !== "ALLIANCE_DUEL_DAY") {
        results.push({ id, ok: false, errorCode: "laterPhase" });
        continue;
      }
      const resolutionData = pending.resolutionData as UploadResolutionData | null;
      const review = await computeUploadReview({ kind: pending.type, leaderboardType, rows, resolutionData });
      if (review.summary.unresolvedOutliers > 0) {
        results.push({ id, ok: false, errorCode: "unresolvedOutliers" });
        continue;
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
            results.push({ id, ok: false, errorCode: "unmatchedRows" });
            continue;
          }
          throw error;
        }
      } else {
        results.push({ id, ok: false, errorCode: "laterPhase" });
        continue;
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
      await createAuditLog(actor.id, "UPLOAD_APPROVED", "PendingChange", id, pickSnapshot(pending), pickSnapshot(jsonSafe(updated)));
      await createNotification(updated.submitter.id, "UPLOAD_APPROVED", "uploadApproved", {
        uploadType: leaderboardType ?? pending.type,
      }, { pendingChangeId: id });
      results.push({ id, ok: true });
    }

    return NextResponse.json({ ok: true, results });
  } catch (error) {
    return apiError(error);
  }
}
