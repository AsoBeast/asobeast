import type { INestApplication } from '@nestjs/common';
import helmet from 'helmet';

const HSTS_MAX_AGE_SECONDS = 31_536_000;

export function configureSecurityHeaders(app: INestApplication): void {
  app.use(
    helmet({
      contentSecurityPolicy: false,
      frameguard: { action: 'deny' },
      hsts: {
        maxAge: HSTS_MAX_AGE_SECONDS,
        includeSubDomains: true,
        preload: false,
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );
}
