import './helpers/enable-auth';
import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication, Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { API_TOKEN_PREFIX, ApiErrorEnvelope } from '@asobeast/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { restoreAuthEnv } from './helpers/auth-env';
import { startRedisOutage, type RedisOutage } from './helpers/redis-outage';
import { OWNER, ownerAgent } from './helpers/session';
import { testDb } from './helpers/test-db';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

const ANSWER_DEADLINE_MS = 3_000;
const REJECTED_TOKEN = `${API_TOKEN_PREFIX}${'3'.repeat(48)}`;
const RECOVERY_DEADLINE_MS = 15_000;
const RECONNECT_CYCLES_MS = 2_500;
const OUTAGE_WARNING = 'redis is unreachable';
const NO_STORE = {
  get: () => {
    throw new Error('no store request may leave while redis is down');
  },
};

function within(test: request.Test): request.Test {
  return test.timeout({
    response: ANSWER_DEADLINE_MS,
    deadline: ANSWER_DEADLINE_MS,
  });
}

async function refusedWithWait(test: request.Test): Promise<void> {
  const response = await within(test).expect(503);
  const body = response.body as ApiErrorEnvelope;
  expect(body.retryAfterSeconds).toBeGreaterThan(0);
  expect(response.headers['retry-after']).toBe(String(body.retryAfterSeconds));
}

describe('Redis outage (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let outage: RedisOutage;
  let agent: ReturnType<typeof request.agent>;
  let appId: string;
  let pausedKeywordId: string;
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

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StoreProviderRegistry)
      .useValue(NO_STORE)
      .compile();
    app = moduleFixture.createNestApplication<App>();
    app.use(cookieParser());
    await app.init();
    await pauseQueues(app);

    prisma = testDb();
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword", "User" RESTART IDENTITY CASCADE',
    );
    agent = await ownerAgent(app);
    appId = (
      await prisma.app.create({
        data: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          store: 'APP_STORE',
          storeAppId: '904237743',
          country: 'us',
          name: 'Queued While Down',
        },
      })
    ).id;
    pausedKeywordId = (
      await prisma.keyword.create({
        data: { text: 'notizen', store: 'APP_STORE', country: 'de' },
      })
    ).id;
    await prisma.trackedKeyword.create({
      data: {
        appId,
        keywordId: pausedKeywordId,
        source: 'MANUAL',
        active: false,
      },
    });
  });

  afterAll(async () => {
    await outage.restore().catch(() => undefined);
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword", "User" RESTART IDENTITY CASCADE',
    );
    await obliterateQueues(app);
    await app.close();
    await outage.stop();
    process.env.REDIS_PORT = String(upstreamPort);
    restoreAuthEnv();
    await prisma.$disconnect();
  });

  describe('while redis is down', () => {
    beforeAll(async () => {
      await outage.sever();
    });

    afterAll(async () => {
      await outage.restore();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('answers a signed in request from postgres', async () => {
      await within(agent.get('/auth/me')).expect(200);
    });

    it('lists apps for a signed in request', async () => {
      await within(agent.get('/apps')).expect(200);
    });

    it('answers a refused credential with 401', async () => {
      await within(
        request(app.getHttpServer())
          .get('/apps')
          .set('Authorization', `Bearer ${REJECTED_TOKEN}`),
      ).expect(401);
    });

    it('refuses a sign in with 503 and a wait instead of hanging', async () => {
      const response = await within(
        request(app.getHttpServer()).post('/auth/login').send(OWNER),
      ).expect(503);

      const body = response.body as ApiErrorEnvelope;
      expect(body.retryAfterSeconds).toBeGreaterThan(0);
      expect(response.headers['retry-after']).toBe(
        String(body.retryAfterSeconds),
      );
    });

    it.each([
      ['an added keyword', 'post', 'keywords', { keywords: ['notes'] }],
      ['a deep search', 'post', 'keywords/spider', { term: 'notes' }],
      ['a run daily', 'post', 'run-daily', {}],
      ['a refresh', 'post', 'refresh', {}],
      [
        'a keyword import',
        'post',
        'keywords/import',
        { rows: [{ keyword: 'notes' }] },
      ],
      ['a keyword field', 'put', 'keyword-field', { text: 'notes' }],
      [
        'an added competitor',
        'post',
        'competitors',
        { url: 'https://apps.apple.com/us/app/x/id1' },
      ],
      ['a market seed', 'post', 'market-seed', { country: 'de' }],
    ] as const)(
      'refuses %s with 503 and a wait instead of waiting on the queue',
      async (_label, method, path, body) => {
        await refusedWithWait(
          agent[method](`/apps/${appId}/${path}`).send(body),
        );
      },
    );

    it('refuses to resume a keyword of another market with 503 instead of waiting on the queue', async () => {
      await refusedWithWait(
        agent
          .patch(`/apps/${appId}/keywords/${pausedKeywordId}`)
          .send({ active: true }),
      );
    });

    it('refuses an app import with 503 instead of waiting on the queue', async () => {
      await refusedWithWait(
        agent
          .post('/apps')
          .send({ url: 'https://apps.apple.com/us/app/things-3/id904237744' }),
      );
    });

    it('lists actions for a signed in request', async () => {
      await within(agent.get('/actions')).expect(200);
    });

    it('summarises actions for a signed in request', async () => {
      await within(agent.get('/actions/summary')).expect(200);
    });

    it('reports store health for a signed in request', async () => {
      await within(agent.get('/jobs/store-health')).expect(200);
    });

    it('serves the operator scrape and names the outage in it', async () => {
      const response = await within(agent.get('/metrics')).expect(200);

      expect(response.text).toContain('dependency.redis.unavailable');
    });

    it('still reports the outage on the health endpoint', async () => {
      const response = await within(
        request(app.getHttpServer()).get('/health'),
      ).expect(200);

      expect(response.body).toMatchObject({ status: 'ok', redis: 'down' });
    });

    it('names the outage in the json log instead of printing raw stack traces', async () => {
      const printed = jest.spyOn(console, 'error').mockReturnValue();
      const warned = jest.spyOn(Logger.prototype, 'warn');
      const failed = jest.spyOn(Logger.prototype, 'error');

      await new Promise((resolve) => setTimeout(resolve, RECONNECT_CYCLES_MS));

      expect(printed).not.toHaveBeenCalled();
      expect(failed).not.toHaveBeenCalled();
      expect(
        warned.mock.calls.filter(([message]) =>
          String(message).startsWith(OUTAGE_WARNING),
        ).length,
      ).toBeLessThanOrEqual(1);
    });
  });

  it('serves signed in requests and sign ins again once redis returns', async () => {
    const deadline = Date.now() + RECOVERY_DEADLINE_MS;
    let status = 0;
    while (status !== 200 && Date.now() < deadline) {
      status = (
        await request(app.getHttpServer())
          .post('/auth/login')
          .send(OWNER)
          .timeout({ response: ANSWER_DEADLINE_MS })
          .catch(() => ({ status: 0 }))
      ).status;
      if (status !== 200) await new Promise((r) => setTimeout(r, 250));
    }

    expect(status).toBe(200);
    await within(agent.get('/auth/me')).expect(200);
  }, 30_000);
});
