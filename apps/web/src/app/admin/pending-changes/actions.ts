"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@tiles-survive/database";
import { auth } from "@/lib/auth";
import { importRaidRegistrations } from "@/app/dashboard/events/reservoir-raid/actions";
import { applyEventImport } from "@/app/dashboard/alliance-actions";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "admin") {
    return null;
  }
  return session;
}

export async function approvePendingChange(
  changeId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  const change = await prisma.pendingChange.findUnique({
    where: { id: changeId },
    select: { id: true, type: true, payload: true, status: true },
  });

  if (!change) return { success: false, error: "Not found" };
  if (change.status !== "PENDING") return { success: false, error: "Already resolved" };

  const args = JSON.parse(change.payload) as Record<string, unknown>;
  let applied = false;

  if (change.type === "RAID_REGISTRATIONS") {
    const result = await importRaidRegistrations(
      args.planId as string,
      args.payload as string,
    );
    applied = result.ok === true && !result.pending;
  } else {
    const result = await applyEventImport(
      args.eventType as string,
      args.payload as string,
      args.acceptedUsernames as string[],
    );
    applied = result.success === true && !result.pending;
  }

  if (!applied) {
    return { success: false, error: "Apply failed" };
  }

  await prisma.$transaction([
    prisma.pendingChange.update({
      where: { id: changeId },
      data: { status: "APPROVED", reviewerId: session.user.id },
    }),
    prisma.auditLog.create({
      data: {
        action: "PENDING_CHANGE_APPROVED",
        targetId: changeId,
        actorId: session.user.id,
      },
    }),
  ]);

  revalidatePath("/admin/pending-changes");
  return { success: true };
}

export async function rejectPendingChange(
  changeId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  const change = await prisma.pendingChange.findUnique({
    where: { id: changeId },
    select: { id: true, status: true },
  });

  if (!change) return { success: false, error: "Not found" };
  if (change.status !== "PENDING") return { success: false, error: "Already resolved" };

  await prisma.$transaction([
    prisma.pendingChange.update({
      where: { id: changeId },
      data: { status: "REJECTED", reviewerId: session.user.id },
    }),
    prisma.auditLog.create({
      data: {
        action: "PENDING_CHANGE_REJECTED",
        targetId: changeId,
        actorId: session.user.id,
      },
    }),
  ]);

  revalidatePath("/admin/pending-changes");
  return { success: true };
}
