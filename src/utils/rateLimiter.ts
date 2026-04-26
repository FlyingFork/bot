import { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS } from "@/utils/constants";

const windows = new Map<string, number[]>();

/**
 * Sliding-window rate limiter. Returns true if the request is allowed,
 * false if the user has exceeded RATE_LIMIT_MAX requests in RATE_LIMIT_WINDOW_MS.
 */
export function checkRateLimit(guildId: string, userId: string): boolean {
  const key = `${guildId}:${userId}`;
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;

  let timestamps = windows.get(key);
  if (!timestamps) {
    timestamps = [];
    windows.set(key, timestamps);
  }

  // Evict expired timestamps
  while (timestamps.length > 0 && timestamps[0] < cutoff) {
    timestamps.shift();
  }

  if (timestamps.length >= RATE_LIMIT_MAX) {
    return false;
  }

  timestamps.push(now);
  return true;
}
