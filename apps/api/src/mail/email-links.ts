import { EMAIL_MARK_PATH } from '@asobeast/shared';

export function webLink(origin: string | null, path: string): string | null {
  return origin ? `${origin}${path}` : null;
}

export function logoUrl(origin: string | null): string | null {
  return webLink(origin, EMAIL_MARK_PATH);
}

export function hostOf(origin: string | null): string | null {
  return origin ? new URL(origin).host : null;
}

export function atHost(origin: string | null): string {
  const host = hostOf(origin);
  return host ? ` at ${host}` : '';
}
