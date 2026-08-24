import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from './config/env';

const SERVED_PROTOCOLS = ['http:', 'https:'];

export function servedOrigin(webPublicUrl: string | undefined): string | null {
  if (!webPublicUrl) return null;
  let url: URL;
  try {
    url = new URL(webPublicUrl);
  } catch {
    return null;
  }
  if (!SERVED_PROTOCOLS.includes(url.protocol)) return null;
  return url.origin;
}

export function configureCors(app: INestApplication): void {
  const origin = servedOrigin(
    app.get(ConfigService<Env, true>).get('WEB_PUBLIC_URL', { infer: true }),
  );
  if (!origin) return;
  app.enableCors({ origin: [origin] });
}
