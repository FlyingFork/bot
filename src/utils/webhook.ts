import { Client, TextChannel, WebhookClient } from "discord.js";
import db from "@/utils/db";
import { WEBHOOK_NAME } from "@/utils/constants";
import type { TranslationChannel } from "@/generated/prisma/client";

// ── In-memory caches ──────────────────────────────────────────────────────────

// channelId → live WebhookClient
const webhookClientCache = new Map<string, WebhookClient>();

// Webhook IDs owned by this bot — used to detect and ignore our own forwarded messages
const ownWebhookIds = new Set<string>();

// ── Startup warm-up ───────────────────────────────────────────────────────────

/**
 * Loads all TranslationChannel records that have stored webhook credentials
 * and populates the in-memory caches. Called once from the ready event.
 */
export async function initWebhookCache(client: Client): Promise<void> {
  const records = await db.translationChannel.findMany({
    where: { webhookId: { not: null }, webhookToken: { not: null } },
  });

  let loaded = 0;
  for (const record of records) {
    if (!record.webhookId || !record.webhookToken) continue;

    try {
      // Verify the webhook still exists in Discord
      const channel = await client.channels
        .fetch(record.channelId)
        .catch(() => null);

      if (channel instanceof TextChannel) {
        const webhooks = await channel.fetchWebhooks().catch(() => null);
        const existing = webhooks?.find((w) => w.id === record.webhookId);

        if (existing?.token) {
          const wc = new WebhookClient({ id: existing.id, token: existing.token });
          webhookClientCache.set(record.channelId, wc);
          ownWebhookIds.add(existing.id);
          loaded++;
        } else {
          // Webhook is gone — clear stale tokens so it gets recreated on next use
          await db.translationChannel
            .update({
              where: { id: record.id },
              data: { webhookId: null, webhookToken: null },
            })
            .catch(() => {});
        }
      }
    } catch (err) {
      console.warn(`[webhook] Failed to warm up webhook for channel ${record.channelId}:`, err);
    }
  }

  console.log(`[webhook] Cache warm-up complete: ${loaded} webhook(s) loaded.`);
}

// ── Loop prevention ───────────────────────────────────────────────────────────

/** Returns true if the webhook ID belongs to this bot — ignore those messages. */
export function isOwnWebhook(webhookId: string): boolean {
  return ownWebhookIds.has(webhookId);
}

// ── Webhook retrieval / creation ──────────────────────────────────────────────

/**
 * Returns a WebhookClient for the given channel using the TranslationChannel DB record.
 * Checks the in-memory cache first, then validates the stored webhook still exists
 * in Discord, and recreates it if needed. Keeps the DB and both caches in sync.
 */
export async function getOrCreateWebhook(
  channel: TextChannel,
  channelRecord: TranslationChannel,
): Promise<WebhookClient> {
  const cached = webhookClientCache.get(channel.id);
  if (cached) return cached;

  // Try to reuse the webhook stored in the DB record
  if (channelRecord.webhookId && channelRecord.webhookToken) {
    const webhooks = await channel.fetchWebhooks();
    const existing = webhooks.find((w) => w.id === channelRecord.webhookId);
    if (existing?.token) {
      const wc = new WebhookClient({ id: existing.id, token: existing.token });
      webhookClientCache.set(channel.id, wc);
      ownWebhookIds.add(existing.id);
      return wc;
    }
    // Webhook confirmed gone — fall through to recreate
  }

  const webhook = await channel.createWebhook({ name: WEBHOOK_NAME });

  await db.translationChannel.update({
    where: { id: channelRecord.id },
    data: { webhookId: webhook.id, webhookToken: webhook.token! },
  });

  const wc = new WebhookClient({ id: webhook.id, token: webhook.token! });
  webhookClientCache.set(channel.id, wc);
  ownWebhookIds.add(webhook.id);

  console.log(`[webhook] Created new webhook for channel ${channel.id}`);
  return wc;
}

/** Removes a channel's webhook client from the in-memory caches. */
export function invalidateWebhookCache(channelId: string): void {
  const wc = webhookClientCache.get(channelId);
  if (wc) {
    // We don't know the webhook ID from the client object, so we can't remove
    // from ownWebhookIds here — but that's safe: worst case we ignore one extra
    // message on a deleted channel, which never arrives anyway.
    webhookClientCache.delete(channelId);
  }
}
