"use server";

import { prisma } from "@tiles-survive/database";

export async function checkUsernameAvailability(
  username: string
): Promise<{ available: boolean }> {
  if (!username || username.length < 3) return { available: false };

  // Username comparison is case-sensitive (stored in original case)
  // to avoid Turkish dotted-i issues with JS string normalization.
  const existing = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });

  return { available: !existing };
}
