import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { Logger as PinoLogger } from 'nestjs-pino';
import { SUPPORTED_STORES } from '@asobeast/shared';
import { configureAdminSurfaces } from './admin-surfaces';
import { configureCors } from './cors';
import { AppModule } from './app.module';
import { enableGracefulShutdown } from './graceful-shutdown';
import { configureSecurityHeaders } from './security-headers';
import { ADMIN_QUEUES_ROUTE } from './auth/admin-access';
import type { Env } from './config/env';
import { applyTrustedProxy } from './config/trusted-proxy';

type JsonSerializableBigInt = { toJSON: () => number };
(BigInt.prototype as unknown as JsonSerializableBigInt).toJSON = function (
  this: bigint,
) {
  return Number(this);
};

const RETIRED_ENV = ['BULL_BOARD_USER', 'BULL_BOARD_PASSWORD'];

function warnOnRetiredEnv(): void {
  const present = RETIRED_ENV.filter((name) => process.env[name]);
  if (present.length === 0) return;
  Logger.warn(
    `${present.join(' and ')} ignored: ${ADMIN_QUEUES_ROUTE} now requires an owner session or personal API token. Remove them from your environment.`,
    'Bootstrap',
  );
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    bufferLogs: true,
  });
  app.useLogger(app.get(PinoLogger));
  app.flushLogs();
  configureCors(app);
  configureSecurityHeaders(app);
  app.use(cookieParser());

  const config = app.get(ConfigService<Env, true>);
  applyTrustedProxy(app, config.get('TRUST_PROXY', { infer: true }));

  configureAdminSurfaces(app);
  enableGracefulShutdown(app);
  warnOnRetiredEnv();

  // Proves the compiled @asobeast/shared package is consumed by the API.
  Logger.log(`Supported stores: ${SUPPORTED_STORES.join(', ')}`, 'Bootstrap');

  await app.listen(process.env.PORT ?? 4000);
}
void bootstrap();
