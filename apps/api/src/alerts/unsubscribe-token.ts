import { createHmac, timingSafeEqual } from 'node:crypto';

const PURPOSE = 'email-alert-unsubscribe';

export function unsubscribeToken(secret: string, alertId: string): string {
  return createHmac('sha256', secret)
    .update(`${PURPOSE}:${alertId}`)
    .digest('base64url');
}

export function isUnsubscribeToken(
  secret: string,
  alertId: string,
  token: string,
): boolean {
  const expected = Buffer.from(unsubscribeToken(secret, alertId));
  const given = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
