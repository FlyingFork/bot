"use server";

import { prisma } from "@tiles-survive/database";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

export async function verifyUser(userId: string): Promise<{ success: boolean; error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session || session.user.role !== "admin") {
    return { success: false, error: "Unauthorized" };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { emailVerified: true },
  });

  await prisma.auditLog.create({
    data: {
      action: "USER_VERIFIED",
      targetId: userId,
      actorId: session.user.id,
    },
  });

  revalidatePath("/admin/pending");
  revalidatePath("/admin");
  return { success: true };
}
