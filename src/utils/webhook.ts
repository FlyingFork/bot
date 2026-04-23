import { TextChannel, WebhookClient } from 'discord.js';
import db from '@/utils/db';

/**
 * Returns a WebhookClient for the given channel.
 * Checks the database first, verifies the webhook still exists in Discord,
 * and creates a new one if needed. Always keeps the database in sync.
 */
export async function getOrCreateWebhook(channel: TextChannel): Promise<WebhookClient> {
  const record = await db.channelWebhook.findUnique({
    where: { channelId: channel.id },
  });

  if (record) {
    try {
      const webhooks = await channel.fetchWebhooks();
      const existing = webhooks.find((w) => w.id === record.webhookId);
      if (existing?.token) {
        return new WebhookClient({ id: existing.id, token: existing.token });
      }
    } catch (err) {
      console.error(`[Webhook] Could not fetch webhooks for channel ${channel.id}:`, err);
    }
    // Webhook no longer exists in Discord — fall through to recreate.
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
