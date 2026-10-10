import './helpers/enable-auth';
import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types';
import { restoreAuthEnv } from './helpers/auth-env';
import { startRedisOutage, type RedisOutage } from './helpers/redis-outage';

const SHUTDOWN_DEADLINE_MS = 5_000;

const elapse = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

describe('Shutdown while redis has been down since boot (e2e)', () => {
  let app: INestApplication<App>;
  let outage: RedisOutage;
  const upstreamPort = Number(process.env.REDIS_PORT);

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });
    outage = await startRedisOutage(upstreamPort);
    await outage.sever();
    process.env.REDIS_PORT = String(outage.port);
    const { AppModule } = await import('../src/app.module');
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication<App>();
    await app.init();
  });

  afterAll(async () => {
    await outage.stop();
    process.env.REDIS_PORT = String(upstreamPort);
    restoreAuthEnv();
  });

  it(
    'stops promptly although no queue connection ever opened',
    async () => {
      const stopped = await Promise.race([
        app.close().then(() => true),
        elapse(SHUTDOWN_DEADLINE_MS).then(() => false),
      ]);

      expect(stopped).toBe(true);
    },
    SHUTDOWN_DEADLINE_MS + 5_000,
  );
});
