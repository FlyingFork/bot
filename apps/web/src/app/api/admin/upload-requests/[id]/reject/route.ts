import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@tiles-survive/database";
import { createAuditLog } from "@/lib/audit";
import { jsonSafe, pickSnapshot } from "@/lib/json";
import { createNotification } from "@/lib/notifications";
import { apiError, requireAdmin } from "@/lib/server-auth";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Params) {
  try {
    const actor = await requireAdmin();
    const { id } = await context.params;
    const body = (await request.json()) as { note?: string };
    const note = body.note?.trim();
    if (!note) return NextResponse.json({ errorCode: "noteRequired" }, { status: 400 });

    const before = await prisma.pendingChange.findUnique({
      where: { id },
      include: { submitter: { select: { id: true } } },
    });
    if (!before) return NextResponse.json({ errorCode: "notFound" }, { status: 404 });
    if (before.status !== "PENDING") return NextResponse.json({ errorCode: "notPending" }, { status: 400 });

    const updated = await prisma.pendingChange.update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewerId: actor.id,
        reviewedAt: new Date(),
        rejectionNote: note,
      },
    });

    await createAuditLog(
      actor.id,
      "UPLOAD_REJECTED",
      "PendingChange",
      id,
      pickSnapshot(before),
      pickSnapshot(jsonSafe(updated)),
    );
    await createNotification(before.submitter.id, "UPLOAD_REJECTED", "uploadRejected", {
      uploadType: before.leaderboardType ?? before.type,
      note,
    }, { pendingChangeId: id });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
