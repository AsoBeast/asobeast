import { EmailAlert } from '@prisma/client';
import { EmailAlertItem, WebhookEvent } from '@asobeast/shared';

export function toEmailAlertItem(alert: EmailAlert): EmailAlertItem {
  return {
    id: alert.id,
    email: alert.email,
    events: alert.events as WebhookEvent[],
    reviewScores: alert.reviewScores,
    active: alert.active,
    confirmed: alert.confirmedAt !== null,
    unsubscribed: alert.unsubscribedAt !== null,
    createdAt: alert.createdAt.toISOString(),
  };
}
