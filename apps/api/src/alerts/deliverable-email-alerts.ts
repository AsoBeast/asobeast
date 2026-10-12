import { Prisma } from '@prisma/client';

export const DELIVERABLE_EMAIL_ALERTS = {
  active: true,
  confirmedAt: { not: null },
} satisfies Prisma.EmailAlertWhereInput;

export function isDeliverable(alert: {
  active: boolean;
  confirmedAt: Date | null;
}): boolean {
  return alert.active && alert.confirmedAt !== null;
}
