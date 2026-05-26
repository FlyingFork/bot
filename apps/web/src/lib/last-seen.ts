import { prisma } from "@tiles-survive/database";

const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000;

export async function touchLastSeen(userId: string) {
  const threshold = new Date(Date.now() - LAST_SEEN_THROTTLE_MS);

  await prisma.user.updateMany({
    where: {
      id: userId,
      OR: [
        { lastSeenAt: null },
        { lastSeenAt: { lt: threshold } },
      ],
    },
    data: { lastSeenAt: new Date() },
  }).catch(() => undefined);
}
