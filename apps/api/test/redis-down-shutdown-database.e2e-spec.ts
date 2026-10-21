import './helpers/enable-auth';
import { execSync } from 'child_process';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { App } from 'supertest/types';
import { restoreAuthEnv } from './helpers/auth-env';
import {
  answerOf,
  elapse,
  lockUserTable,
  pendingAfter,
  type TableLock,
} from './helpers/held-query';
import { startRedisOutage, type RedisOutage } from './helpers/redis-outage';
import { testDb } from './helpers/test-db';

const SHUTDOWN_DEADLINE_MS = 6_000;
const QUERY_SETTLE_MS = 300;

describe('Shutdown with redis lost and a query held on postgres (e2e)', () => {
  jest.setTimeout(60_000);

  let app: INestApplication<App>;
  let outage: RedisOutage;
  let prisma: PrismaClient;
  let lock: TableLock | undefined;
  let closing: Promise<void> | undefined;
  const upstreamPort = Number(process.env.REDIS_PORT);

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });
    outage = await startRedisOutage(upstreamPort);
    process.env.REDIS_PORT = String(outage.port);
    const { AppModule } = await import('../src/app.module');
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication<App>();
    await app.init();
    await app.listen(0);
    prisma = testDb();
  });

  afterAll(async () => {
    try {
      await lock?.release();
      await (closing ?? app.close());
    } finally {
      await outage.stop();
      process.env.REDIS_PORT = String(upstreamPort);
      restoreAuthEnv();
      await prisma.$disconnect();
    }
  });

  it('stops within the bound while a request waits on a postgres lock', async () => {
    const port = ((app.getHttpServer() as Server).address() as AddressInfo)
      .port;
    await outage.sever();
    lock = await lockUserTable(prisma);
    const answer = answerOf(port, '/auth/status');
    expect(await pendingAfter(answer, QUERY_SETTLE_MS)).toBe(true);

    const startedAt = Date.now();
    closing = app.close();
    const stopped = await Promise.race([
      closing.then(() => true),
      elapse(SHUTDOWN_DEADLINE_MS).then(() => false),
    ]);

    expect(stopped).toBe(true);
    expect(Date.now() - startedAt).toBeLessThan(SHUTDOWN_DEADLINE_MS);
    await expect(answer).resolves.toBe('cut');
  });
});
