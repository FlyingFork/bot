import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@tiles-survive/database";
import { createAuditLog } from "@/lib/audit";
import { jsonSafe, pickSnapshot } from "@/lib/json";
import { createNotification } from "@/lib/notifications";
import { apiError, requireAdmin } from "@/lib/server-auth";

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAdmin();
    const body = (await request.json()) as { ids?: string[]; note?: string };
    const ids = Array.isArray(body.ids) ? body.ids : [];
    const note = body.note?.trim();
    if (!note) return NextResponse.json({ errorCode: "noteRequired" }, { status: 400 });

    const changes = await prisma.pendingChange.findMany({
      where: { id: { in: ids }, status: "PENDING" },
      include: { submitter: { select: { id: true } } },
    });

    for (const change of changes) {
      const updated = await prisma.pendingChange.update({
        where: { id: change.id },
        data: {
          status: "REJECTED",
          reviewerId: actor.id,
          reviewedAt: new Date(),
          rejectionNote: note,
        },
      });
      await createAuditLog(actor.id, "UPLOAD_REJECTED", "PendingChange", change.id, pickSnapshot(change), pickSnapshot(jsonSafe(updated)));
      await createNotification(change.submitter.id, "UPLOAD_REJECTED", "uploadRejected", {
        uploadType: change.leaderboardType ?? change.type,
        note,
      }, { pendingChangeId: change.id });
    }

    return NextResponse.json({ ok: true, count: changes.length });
  } catch (error) {
    return apiError(error);
  }
}
