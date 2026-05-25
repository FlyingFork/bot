import { NextRequest, NextResponse } from "next/server";
import { apiError, requireMinRole } from "@/lib/server-auth";
import { hasPendingUpload, type UploadTarget } from "@/lib/uploads";

export async function GET(request: NextRequest) {
  try {
    await requireMinRole("r4");
    const params = request.nextUrl.searchParams;
    const target: UploadTarget = {
      kind: params.get("kind") as UploadTarget["kind"],
      leaderboardType: params.get("leaderboardType") as UploadTarget["leaderboardType"],
      eventInstanceId: params.get("eventInstanceId"),
      eventInstanceType: params.get("eventInstanceType"),
      eventDay: params.get("eventDay") ? Number(params.get("eventDay")) : null,
    };
    const pending = await hasPendingUpload(target);
    return NextResponse.json({ locked: Boolean(pending), pendingId: pending ? pending.id : null });
  } catch (error) {
    return apiError(error);
  }
}
