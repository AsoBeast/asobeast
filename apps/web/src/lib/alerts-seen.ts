import { readCookieValue } from "./cookie-value";

export const ALERTS_SEEN_COOKIE_NAME = "asobeast_alerts_seen";
export const ALERTS_SEEN_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const SEEN_VALUE_MAX_CHARS = 40;

export function parseSeen(value: string | undefined): string | null {
  if (!value || value.length > SEEN_VALUE_MAX_CHARS) return null;
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return null;
  return instant.toISOString() === value ? value : null;
}

export function seenCookie(instant: string): string {
  return `${ALERTS_SEEN_COOKIE_NAME}=${encodeURIComponent(instant)}; path=/; max-age=${ALERTS_SEEN_COOKIE_MAX_AGE}; samesite=lax`;
}

export function readSeenCookie(cookieString: string): string | undefined {
  return readCookieValue(cookieString, ALERTS_SEEN_COOKIE_NAME);
}

const isAfter = (left: string, right: string): boolean =>
  Date.parse(left) > Date.parse(right);

export function hasUnread(
  newest: string | null | undefined,
  seen: string | null,
): boolean {
  if (!newest) return false;
  return seen === null || isAfter(newest, seen);
}

export function isNewSince(occurredAt: string, seen: string | null): boolean {
  return seen !== null && isAfter(occurredAt, seen);
}

export function laterOf(current: string | null, next: string): string {
  return current !== null && !isAfter(next, current) ? current : next;
}
