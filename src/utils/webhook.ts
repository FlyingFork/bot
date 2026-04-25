import { TextChannel, WebhookClient } from 'discord.js';
import db from '@/utils/db';

/**
 * Returns a WebhookClient for the given channel.
 * Checks the database first, verifies the webhook still exists in Discord,
 * and creates a new one if needed. Always keeps the database in sync.
 *
 * E2: fetchWebhooks errors (network, missing MANAGE_WEBHOOKS) now propagate to
 * the caller instead of silently falling through to recreation, which would
 * orphan the old webhook in Discord.
 */
export async function getOrCreateWebhook(channel: TextChannel): Promise<WebhookClient> {
  const record = await db.channelWebhook.findUnique({
    where: { channelId: channel.id },
  });

  if (record) {
    // Let errors propagate — only recreate when the fetch succeeds but the
    // specific webhook is genuinely absent.
    const webhooks = await channel.fetchWebhooks();
    const existing = webhooks.find((w) => w.id === record.webhookId);
    if (existing?.token) {
      return new WebhookClient({ id: existing.id, token: existing.token });
    }
    // Webhook confirmed gone in Discord — fall through to recreate.
  }

  const webhook = await channel.createWebhook({ name: 'TranslatorBridge' });

  await db.channelWebhook.upsert({
    where: { channelId: channel.id },
    create: {
      channelId: channel.id,
      webhookId: webhook.id,
      webhookToken: webhook.token!,
    },
    update: {
      webhookId: webhook.id,
      webhookToken: webhook.token!,
    },
  });

  return new WebhookClient({ id: webhook.id, token: webhook.token! });
}
