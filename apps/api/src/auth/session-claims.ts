import type { SessionClaims } from './auth.types';

export function sessionClaimsOf(payload: unknown): SessionClaims | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const { sub, sv, jti } = payload as Record<string, unknown>;
  if (typeof sub !== 'string' || typeof jti !== 'string' || jti === '') {
    return null;
  }
  if (typeof sv !== 'number' || !Number.isInteger(sv)) return null;
  return { sub, sv, jti };
}
