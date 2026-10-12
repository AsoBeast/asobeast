import { API_TOKEN_PREFIX } from '@asobeast/shared';

const BEARER_CREDENTIALS = /^bearer +([A-Za-z0-9._~+/-]+=*)$/i;

export function bearerToken(authorization: string | undefined): string | null {
  return BEARER_CREDENTIALS.exec(authorization?.trim() ?? '')?.[1] ?? null;
}

export function apiToken(authorization: string | undefined): string | null {
  const token = bearerToken(authorization);
  return token?.startsWith(API_TOKEN_PREFIX) ? token : null;
}
