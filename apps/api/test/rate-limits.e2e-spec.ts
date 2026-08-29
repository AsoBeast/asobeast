import './helpers/enable-billing';
import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import {
  API_TOKEN_PREFIX,
  MINUTE_SECONDS,
  PLAN_LIMITS,
  type ApiErrorEnvelope,
} from '@asobeast/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { sha256 } from '../src/auth/password-hash';
import { CREDENTIAL_FAILURES_PER_MINUTE } from '../src/auth/rate-limit/credential-rate.limiter';
import { RequestRateLimiter } from '../src/auth/rate-limit/request-rate.limiter';
import { secondsUntilReset } from '../src/auth/rate-limit/window';
import { restoreAuthEnv } from './helpers/auth-env';
import { testDb } from './helpers/test-db';
import {
  clearOnDemandCounters,
  clearRateLimitCounters,
  obliterateQueues,
  pauseQueues,
  spendCredentialBudget,
} from './obliterate-queues';

const PASSWORD = 'supersecret1';
const WRITES_PER_MINUTE = PLAN_LIMITS.indie.apiWritesPerMinute as number;
const READS_PER_MINUTE = PLAN_LIMITS.indie.apiRequestsPerMinute as number;
const BURN_HEADROOM_SECONDS = 15;

async function awaitBurnHeadroom(): Promise<void> {
  const remaining = secondsUntilReset(MINUTE_SECONDS, new Date());
  if (remaining >= BURN_HEADROOM_SECONDS) return;
  await new Promise((resolve) => setTimeout(resolve, remaining * 1000 + 100));
}

function sessionCookie(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = raw?.find((entry) => entry.startsWith('asobeast_session='));
  if (!cookie) throw new Error('no session cookie set');
  return cookie.split(';')[0];
}

describe('Rate limits (billing mode)', () => {
  jest.setTimeout(45_000);

  let app: INestApplication<App>;
  let prisma: PrismaClient;

  const register = async (email: string): Promise<string> => {
    const created = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: PASSWORD })
      .expect(201);
    return sessionCookie(created);
  };

  const mintToken = async (
    email: string,
    suffix: string,
    scope = 'write',
  ): Promise<string> => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { email },
      select: { id: true },
    });
    const token = `${API_TOKEN_PREFIX}${suffix}`;
    await prisma.apiToken.create({
      data: {
        userId: user.id,
        name: suffix,
        tokenHash: sha256(token),
        prefix: token.slice(0, 12),
        scope,
      },
    });
    return token;
  };

  const write = (cookie: string) =>
    request(app.getHttpServer())
      .patch('/actions/missing')
      .set('Cookie', cookie)
      .send({ status: 'DONE' });

  const read = (cookie: string) =>
    request(app.getHttpServer()).get('/apps').set('Cookie', cookie);

  const burn = async (
    send: (cookie: string) => request.Test,
    cookie: string,
    times: number,
    limit: number,
  ): Promise<void> => {
    await awaitBurnHeadroom();
    for (let spent = 1; spent <= times; spent += 1) {
      const response = await send(cookie);
      expect({
        spent,
        remaining: response.headers['ratelimit-remaining'],
      }).toEqual({ spent, remaining: String(Math.max(limit - spent, 0)) });
    }
  };

  const burnWrites = (cookie: string, times: number): Promise<void> =>
    burn(write, cookie, times, WRITES_PER_MINUTE);

  const burnReads = (cookie: string, times: number): Promise<void> =>
    burn(read, cookie, times, READS_PER_MINUTE);

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
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
  });

  beforeEach(async () => {
    await clearRateLimitCounters(app);
    await clearOnDemandCounters(app);
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "User" RESTART IDENTITY CASCADE',
    );
    await prisma.workspace.deleteMany({
      where: { id: { not: DEFAULT_WORKSPACE_ID } },
    });
    await prisma.workspace.update({
      where: { id: DEFAULT_WORKSPACE_ID },
      data: {
        plan: 'indie',
        planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        suspendedAt: null,
        suspendedReason: null,
      },
    });
  });

  afterAll(async () => {
    await prisma.workspace.update({
      where: { id: DEFAULT_WORKSPACE_ID },
      data: {
        plan: 'free',
        planExpiresAt: null,
        suspendedAt: null,
        suspendedReason: null,
      },
    });
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "User" RESTART IDENTITY CASCADE',
    );
    await obliterateQueues(app);
    await app.close();
    restoreAuthEnv();
    await prisma.$disconnect();
  });

  it('admits reads a workspace has budget for', async () => {
    const cookie = await register('reader@example.com');

    const served = await request(app.getHttpServer())
      .get('/apps')
      .set('Cookie', cookie)
      .expect(200);

    expect(served.headers['ratelimit-limit']).toBe(String(READS_PER_MINUTE));
    expect(Number(served.headers['ratelimit-remaining'])).toBeLessThan(
      READS_PER_MINUTE,
    );
    expect(Number(served.headers['ratelimit-reset'])).toBeGreaterThan(0);
  });

  it('refuses a write burst past the plan allowance', async () => {
    const cookie = await register('writer@example.com');
    await burnWrites(cookie, WRITES_PER_MINUTE);

    const refused = await write(cookie).expect(429);
    const envelope = refused.body as ApiErrorEnvelope;

    expect(envelope.error).toBe('Too Many Requests');
    expect(envelope.message).toContain('per minute');
    expect(envelope.message).toContain('retrying before then will fail');
    expect(envelope.rateLimit).toMatchObject({
      window: 'minute',
      rateClass: 'write',
      plan: 'indie',
      limit: WRITES_PER_MINUTE,
      upgradeTo: 'ultimate',
    });
    expect(envelope.quota).toBeUndefined();
    expect(refused.headers['retry-after']).toBe(
      String(envelope.rateLimit?.resetSeconds),
    );
    expect(refused.headers['ratelimit-remaining']).toBe('0');
    expect(refused.headers['ratelimit-limit']).toBe(String(WRITES_PER_MINUTE));
  });

  it('refuses a read burst past the plan allowance', async () => {
    const cookie = await register('dashboards@example.com');
    await burnReads(cookie, READS_PER_MINUTE - 1);

    await read(cookie).expect(200);
    const refused = await read(cookie).expect(429);
    const envelope = refused.body as ApiErrorEnvelope;

    expect(envelope.rateLimit).toMatchObject({
      window: 'minute',
      rateClass: 'read',
      plan: 'indie',
      limit: READS_PER_MINUTE,
      upgradeTo: 'ultimate',
    });
    expect(refused.headers['retry-after']).toBe(
      String(envelope.rateLimit?.resetSeconds),
    );
    expect(refused.headers['ratelimit-remaining']).toBe('0');
    expect(refused.headers['ratelimit-limit']).toBe(String(READS_PER_MINUTE));
  });

  it('keeps reads flowing while the write budget is spent', async () => {
    const cookie = await register('mixed@example.com');
    await burnWrites(cookie, WRITES_PER_MINUTE + 1);

    await request(app.getHttpServer())
      .get('/apps')
      .set('Cookie', cookie)
      .expect(200);
  });

  it('does not let a second token buy a second allowance', async () => {
    const cookie = await register('tokens@example.com');
    const first = await mintToken('tokens@example.com', 'first-token');
    const second = await mintToken('tokens@example.com', 'second-token');

    await burnWrites(cookie, WRITES_PER_MINUTE);

    await request(app.getHttpServer())
      .patch('/actions/missing')
      .set('Authorization', `Bearer ${first}`)
      .send({ status: 'DONE' })
      .expect(429);
    await request(app.getHttpServer())
      .patch('/actions/missing')
      .set('Authorization', `Bearer ${second}`)
      .send({ status: 'DONE' })
      .expect(429);
  });

  it('leaves a suspended workspace able to read, export and pay', async () => {
    const cookie = await register('suspended@example.com');
    await prisma.workspace.update({
      where: { id: DEFAULT_WORKSPACE_ID },
      data: {
        suspendedAt: new Date(),
        suspendedReason: 'scraping the service',
      },
    });

    await request(app.getHttpServer())
      .get('/apps')
      .set('Cookie', cookie)
      .expect(200);
    await request(app.getHttpServer())
      .get('/billing/catalog')
      .set('Cookie', cookie)
      .expect(200);

    const refused = await write(cookie).expect(403);
    expect((refused.body as ApiErrorEnvelope).message).toContain(
      'scraping the service',
    );
  });

  it('cuts off api access entirely while a workspace is suspended', async () => {
    await register('cutoff@example.com');
    const token = await mintToken('cutoff@example.com', 'cutoff-token');
    await prisma.workspace.update({
      where: { id: DEFAULT_WORKSPACE_ID },
      data: { suspendedAt: new Date(), suspendedReason: 'abuse' },
    });

    await request(app.getHttpServer())
      .get('/apps')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('counts each workspace against its own allowance', async () => {
    const busy = await register('busy@example.com');
    const quiet = await register('quiet@example.com');
    await burnWrites(busy, WRITES_PER_MINUTE + 1);

    await write(quiet).expect(404);
  });

  it('spends one per-minute budget on writes and store requests alike', async () => {
    const cookie = await register('store@example.com');
    await burnWrites(cookie, WRITES_PER_MINUTE);

    const refused = await request(app.getHttpServer())
      .post('/apps/missing/refresh')
      .set('Cookie', cookie)
      .expect(429);

    expect((refused.body as ApiErrorEnvelope).rateLimit).toMatchObject({
      window: 'minute',
      rateClass: 'store',
      limit: WRITES_PER_MINUTE,
    });
  });

  it('lets a read-only token reach a store-touching lookup', async () => {
    await register('readonly@example.com');
    const token = await mintToken('readonly@example.com', 'read-token', 'read');

    await request(app.getHttpServer())
      .get('/apps/missing/keywords/suggestions?strategy=metadata')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
    await request(app.getHttpServer())
      .patch('/actions/missing')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'DONE' })
      .expect(403);
  });

  it('admits one of two callers racing for the last parallel slot', async () => {
    const limiter = app.get(RequestRateLimiter, { strict: false });
    const scope = {
      workspaceId: 'ws_race',
      plan: 'indie' as const,
      limits: { ...PLAN_LIMITS.indie, apiConcurrentRequests: 2 },
    };
    const held = await limiter.acquire(scope);

    const racers = await Promise.allSettled([
      limiter.acquire(scope),
      limiter.acquire(scope),
    ]);

    expect(racers.filter(({ status }) => status === 'fulfilled')).toHaveLength(
      1,
    );
    expect(racers.filter(({ status }) => status === 'rejected')).toHaveLength(
      1,
    );
    for (const racer of racers) {
      if (racer.status === 'fulfilled') await racer.value?.();
    }
    await held?.();
  });

  it('stops looking up rejected credentials from one address', async () => {
    const cookie = await register('accepted@example.com');
    const rejected = `${API_TOKEN_PREFIX}${'0'.repeat(48)}`;
    const present = () =>
      request(app.getHttpServer())
        .get('/apps')
        .set('Authorization', `Bearer ${rejected}`);

    for (let i = 0; i < 5; i += 1) {
      await request(app.getHttpServer())
        .get('/apps')
        .set('Cookie', cookie)
        .expect(200);
    }
    await present().expect(401);
    expect(await spendCredentialBudget(app, 1)).toBe(1);
    await present().expect(401);

    await spendCredentialBudget(app, CREDENTIAL_FAILURES_PER_MINUTE);
    const refused = await present().expect(429);
    const envelope = refused.body as ApiErrorEnvelope;

    expect(envelope.message).toContain(
      'rejected credentials from this address',
    );
    expect(refused.headers['retry-after']).toBe(
      String(envelope.retryAfterSeconds),
    );
  });

  it('counts a rejected token that arrives beside an empty session cookie', async () => {
    const rejected = `${API_TOKEN_PREFIX}${'1'.repeat(48)}`;
    const present = () =>
      request(app.getHttpServer())
        .get('/apps')
        .set('Cookie', 'asobeast_session=')
        .set('Authorization', `Bearer ${rejected}`);

    await present().expect(401);
    expect(
      await spendCredentialBudget(app, CREDENTIAL_FAILURES_PER_MINUTE),
    ).toBe(1);

    await present().expect(429);
  });
});
