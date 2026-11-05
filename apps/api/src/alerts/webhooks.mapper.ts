import { Webhook } from '@prisma/client';
import {
  RATING_DROP_DEFAULT_TENTHS,
  webhookChannelOf,
  WebhookEvent,
  WebhookItem,
} from '@asobeast/shared';

export function toWebhookItem(webhook: Webhook): WebhookItem {
  return {
    id: webhook.id,
    url: webhook.url,
    events: webhook.events as WebhookEvent[],
    reviewScores: webhook.reviewScores,
    active: webhook.active,
    confirmDrops: webhook.confirmDrops,
    ratingDropTenths: webhook.ratingDropTenths ?? RATING_DROP_DEFAULT_TENTHS,
    rankDropThreshold: webhook.rankDropThreshold,
    hasSecret: webhook.secret !== null,
    createdAt: webhook.createdAt.toISOString(),
    channel: webhookChannelOf(webhook.url),
  };
}
