"use server";

import { prisma } from "@tiles-survive/database";

export async function checkUsernameAvailability(
  username: string,
): Promise<{ available: boolean }> {
  if (!username || username.length < 3) return { available: false };

  const existing = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });

  return { available: !existing };
}
