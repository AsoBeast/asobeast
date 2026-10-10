import { createHmac, timingSafeEqual } from 'node:crypto';

const PURPOSE = 'email-alert-unsubscribe';

export const UNSUBSCRIBE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export interface UnsubscribeRecipient {
  alertId: string;
  email: string;
}

export function unsubscribeToken(
  secret: string,
  { alertId, email }: UnsubscribeRecipient,
): string {
  return createHmac('sha256', secret)
    .update(`${PURPOSE}:${alertId}:${email.toLowerCase()}`)
    .digest('base64url');
}

export function isUnsubscribeToken(
  secret: string,
  recipient: UnsubscribeRecipient,
  token: string,
): boolean {
  const expected = Buffer.from(unsubscribeToken(secret, recipient));
  const given = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
