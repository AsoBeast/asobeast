import { isLinkToken, linkToken } from './link-token';

export const CONFIRMATION_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

const PURPOSE = 'email-alert-confirmation';

export interface ConfirmationRecipient {
  alertId: string;
  email: string;
  sentAt: Date;
}

const partsOf = ({
  alertId,
  email,
  sentAt,
}: ConfirmationRecipient): string[] => [
  alertId,
  email.toLowerCase(),
  String(sentAt.getTime()),
];

export function confirmationToken(
  secret: string,
  recipient: ConfirmationRecipient,
): string {
  return linkToken(secret, PURPOSE, partsOf(recipient));
}

export function isConfirmationToken(
  secret: string,
  recipient: ConfirmationRecipient,
  token: string,
): boolean {
  return isLinkToken(secret, PURPOSE, partsOf(recipient), token);
}

export function isConfirmationExpired(sentAt: Date, now = Date.now()): boolean {
  return sentAt.getTime() + CONFIRMATION_DAYS * DAY_MS <= now;
}
