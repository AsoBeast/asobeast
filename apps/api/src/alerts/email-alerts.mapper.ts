import { EmailAlert } from '@prisma/client';
import { EmailAlertItem, WebhookEvent } from '@asobeast/shared';

export function toEmailAlertItem(alert: EmailAlert): EmailAlertItem {
  return {
    id: alert.id,
    email: alert.email,
    events: alert.events as WebhookEvent[],
    active: alert.active,
    createdAt: alert.createdAt.toISOString(),
  };
}
