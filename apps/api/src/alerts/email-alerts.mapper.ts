import { EmailAlert } from '@prisma/client';
import {
  EmailAlertItem,
  RATING_DROP_DEFAULT_TENTHS,
  WebhookEvent,
} from '@asobeast/shared';

export function toEmailAlertItem(alert: EmailAlert): EmailAlertItem {
  return {
    id: alert.id,
    email: alert.email,
    events: alert.events as WebhookEvent[],
    reviewScores: alert.reviewScores,
    active: alert.active,
    confirmDrops: alert.confirmDrops,
    ratingDropTenths: alert.ratingDropTenths ?? RATING_DROP_DEFAULT_TENTHS,
    rankDropThreshold: alert.rankDropThreshold,
    confirmed: alert.confirmedAt !== null,
    unsubscribed: alert.unsubscribedAt !== null,
    createdAt: alert.createdAt.toISOString(),
  };
}
