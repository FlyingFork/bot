import { LRU_MAX_PER_GUILD } from "@/utils/constants";

// targetChannelId → array of webhookMessageIds (array handles multi-chunk messages)
type ForwardMap = Map<string, string[]>;

// guildId → (sourceMessageId → ForwardMap), insertion-ordered for LRU eviction
const guildCaches = new Map<string, Map<string, ForwardMap>>();

function getGuildCache(guildId: string): Map<string, ForwardMap> {
  let cache = guildCaches.get(guildId);
  if (!cache) {
    cache = new Map();
    guildCaches.set(guildId, cache);
  }
  return cache;
}

export function storeForwardedMessage(
  guildId: string,
  sourceMessageId: string,
  targetChannelId: string,
  webhookMessageIds: string[],
): void {
  const cache = getGuildCache(guildId);

  let forwardMap = cache.get(sourceMessageId);
  if (!forwardMap) {
    // Evict oldest entry if at capacity
    if (cache.size >= LRU_MAX_PER_GUILD) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey !== undefined) cache.delete(oldestKey);
    }
    forwardMap = new Map();
    cache.set(sourceMessageId, forwardMap);
  }

  forwardMap.set(targetChannelId, webhookMessageIds);
}

export function getForwardedMessages(
  guildId: string,
  sourceMessageId: string,
): ForwardMap | undefined {
  return guildCaches.get(guildId)?.get(sourceMessageId);
}

export function deleteForwardedMessages(
  guildId: string,
  sourceMessageId: string,
): void {
  guildCaches.get(guildId)?.delete(sourceMessageId);
}
