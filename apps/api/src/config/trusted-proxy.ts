import type { NestExpressApplication } from '@nestjs/platform-express';
import { z } from 'zod';
import { TRUSTED_PROXY_HOPS_MAX, trustedProxyHops } from '@asobeast/shared';

export const TrustedProxyHops = z.preprocess(
  (value) => (typeof value === 'string' ? trustedProxyHops(value) : value),
  z
    .number({
      error: `TRUST_PROXY must be a hop count from 0 to ${TRUSTED_PROXY_HOPS_MAX}, or the boolean spelling true (one hop) or false (none)`,
    })
    .int()
    .min(0)
    .max(TRUSTED_PROXY_HOPS_MAX)
    .default(0),
);

export function applyTrustedProxy(
  app: NestExpressApplication,
  hops: number,
): void {
  if (hops > 0) app.set('trust proxy', hops);
}
