import { Webhook } from '@prisma/client';
import { webhookChannelOf, WebhookEvent, WebhookItem } from '@asobeast/shared';

export function toWebhookItem(webhook: Webhook): WebhookItem {
  return {
    id: webhook.id,
    url: webhook.url,
    events: webhook.events as WebhookEvent[],
    reviewScores: webhook.reviewScores,
    active: webhook.active,
    hasSecret: webhook.secret !== null,
    createdAt: webhook.createdAt.toISOString(),
    channel: webhookChannelOf(webhook.url),
  };
}
