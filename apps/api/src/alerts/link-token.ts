import { createHmac, timingSafeEqual } from 'node:crypto';

export const LINK_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function linkToken(
  secret: string,
  purpose: string,
  parts: readonly string[],
): string {
  return createHmac('sha256', secret)
    .update([purpose, ...parts].join(':'))
    .digest('base64url');
}

export function isLinkToken(
  secret: string,
  purpose: string,
  parts: readonly string[],
  token: string,
): boolean {
  const expected = Buffer.from(linkToken(secret, purpose, parts));
  const given = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
