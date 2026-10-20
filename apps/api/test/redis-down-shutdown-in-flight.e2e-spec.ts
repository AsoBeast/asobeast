import './helpers/enable-auth';
import { execSync } from 'child_process';
import { request as httpRequest, type Server } from 'http';
import type { AddressInfo } from 'net';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { App } from 'supertest/types';
import { configureAdminSurfaces } from '../src/admin-surfaces';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { truncateUsers } from './helpers/api-tokens';
import { restoreAuthEnv } from './helpers/auth-env';
import { startRedisOutage, type RedisOutage } from './helpers/redis-outage';
import {
  OWNER,
  ownerAgent,
  sessionCookieOf,
  useCookies,
} from './helpers/session';
import { testDb } from './helpers/test-db';

const SHUTDOWN_DEADLINE_MS = 6_000;
const REQUEST_SETTLE_MS = 750;
const QUEUES_API = '/admin/queues/api/queues?page=1&jobsPerPage=1';

type Outcome = 'answered' | 'cut';

interface HeldRequest {
  outcome: Promise<Outcome>;
  abort: () => void;
}

const elapse = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

function holdRequest(port: number, cookie: string): HeldRequest {
  let abort = (): void => undefined;
  const outcome = new Promise<Outcome>((resolve) => {
    const held = httpRequest(
      { port, path: QUEUES_API, headers: { cookie } },
      (response) => {
        response.resume();
        resolve('answered');
      },
    );
    held.on('error', () => resolve('cut'));
    held.end();
    abort = () => held.destroy();
  });
  return { outcome, abort };
}

describe('Shutdown with a request waiting on a lost redis (e2e)', () => {
  let app: INestApplication<App>;
  let outage: RedisOutage;
  let prisma: PrismaClient;
  let port: number;
  let cookie: string;
  let held: HeldRequest | undefined;
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
    useCookies(app);
    configureAdminSurfaces(app);
    await app.init();
    await app.listen(0);
    port = ((app.getHttpServer() as Server).address() as AddressInfo).port;

    prisma = testDb();
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
    await truncateUsers(prisma);
    const agent = await ownerAgent(app);
    cookie = sessionCookieOf(await agent.post('/auth/login').send(OWNER));
  });

  afterAll(async () => {
    try {
      held?.abort();
      await (closing ?? app.close());
    } finally {
      await outage.stop();
      process.env.REDIS_PORT = String(upstreamPort);
      restoreAuthEnv();
      await truncateUsers(prisma);
      await prisma.$disconnect();
    }
  });

  it('stops within a bound although a bull board request is waiting on redis', async () => {
    await outage.sever();
    held = holdRequest(port, cookie);
    const beforeStop = await Promise.race([
      held.outcome,
      elapse(REQUEST_SETTLE_MS).then(() => 'waiting' as const),
    ]);
    expect(beforeStop).toBe('waiting');

    const startedAt = Date.now();
    closing = app.close();
    const stopped = await Promise.race([
      closing.then(() => true),
      elapse(SHUTDOWN_DEADLINE_MS).then(() => false),
    ]);

    expect(stopped).toBe(true);
    expect(Date.now() - startedAt).toBeLessThan(SHUTDOWN_DEADLINE_MS);
    await expect(held.outcome).resolves.toBe('cut');
  });
});
