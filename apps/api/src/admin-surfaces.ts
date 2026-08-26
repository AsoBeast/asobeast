import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import {
  ADMIN_QUEUES_SURFACE,
  DOCS_ROUTE,
  DOCS_SURFACES,
  METRICS_SURFACE,
  SUPPORT_SURFACE,
  configureAdminAccess,
} from './auth/admin-access';
import { apiVersion } from './api-version';
import type { Env } from './config/env';

const BEARER_SCHEME = 'personalApiToken';

const API_DESCRIPTION = [
  'Self hosted ASO toolkit API.',
  '',
  'A metered instance carries RateLimit-Limit, RateLimit-Remaining and RateLimit-Reset on every response, for the tightest limit the request touched. A self hosted instance has no request rate limits and sends no such header. Limits are per workspace, so minting more tokens does not buy more capacity, and they are sized per plan across three classes: read for stored data, write for configuration changes and store for the endpoints that reach the App Store or Google Play.',
  '',
  'A 429 carries Retry-After and a rateLimit object naming the window that closed. A 403 with a quota object means a plan capacity limit such as apps or tracked keyword markets, which is a different problem from a rate limit. A 402 with an entitlement object means the workspace needs a plan.',
  '',
  'Positions are 1-based and null means checked but not found within the captured depth, never zero. Daily granularity uses UTC dates.',
].join('\n');

export function configureAdminSurfaces(app: INestApplication): void {
  const docs = app
    .get(ConfigService<Env, true>)
    .get('API_DOCS', { infer: true });

  configureAdminAccess(app, [
    ADMIN_QUEUES_SURFACE,
    METRICS_SURFACE,
    SUPPORT_SURFACE,
    ...(docs === 'owner' ? DOCS_SURFACES : []),
  ]);

  if (docs === 'off') return;

  const document = new DocumentBuilder()
    .setTitle('asobeast API')
    .setDescription(API_DESCRIPTION)
    .setVersion(apiVersion())
    .addServer('http://localhost:3000/api/backend', 'Web origin proxy')
    .addServer('http://localhost:4000', 'Direct API')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'asob' },
      BEARER_SCHEME,
    )
    .addSecurityRequirements(BEARER_SCHEME)
    .build();
  SwaggerModule.setup(DOCS_ROUTE, app, () =>
    SwaggerModule.createDocument(app, document),
  );
}
