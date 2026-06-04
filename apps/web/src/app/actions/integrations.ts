"use server";

import { prisma } from "@tiles-survive/database";
import { requireUser } from "@/lib/server-auth";
import { revalidatePath } from "next/cache";

/**
 * Generates a temporary 6-digit token for linking Discord or Telegram accounts.
 */
export async function generateLinkToken(type: "DISCORD" | "TELEGRAM") {
  const user = await requireUser();

  // Delete any existing link tokens of this type for the user
  await prisma.linkToken.deleteMany({
    where: {
      userId: user.id,
      type,
    },
  });

  // Generate a random 6-digit code
  const token = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

  await prisma.linkToken.create({
    data: {
      token,
      userId: user.id,
      type,
      expiresAt,
    },
  });

  return { success: true, token, expiresAt: expiresAt.toISOString() };
}

/**
 * Unlinks a user's Discord or Telegram account from the platform.
 */
export async function unlinkAccount(type: "DISCORD" | "TELEGRAM") {
  const user = await requireUser();

  if (type === "DISCORD") {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        discordId: null,
        discordUsername: null,
      },
    });
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        telegramId: null,
        telegramUsername: null,
      },
    });
  }

  revalidatePath("/profile");
  return { success: true };
}
