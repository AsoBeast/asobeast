import './helpers/enable-auth';
import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import cookieParser from 'cookie-parser';
import {
  AccountPlan,
  AuthUser,
  DailyBudget,
  PLAN_LIMITS,
} from '@asobeast/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { sha256 } from '../src/auth/password-hash';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { restoreAuthEnv } from './helpers/auth-env';
import { testDb } from './helpers/test-db';
import {
  clearOnDemandCounters,
  clearRateLimitCounters,
  obliterateQueues,
  pauseQueues,
} from './obliterate-queues';

const PAST_INDIE_APPS = (PLAN_LIMITS.indie.apps ?? 0) + 1;
const PAST_INDIE_RUNS = (PLAN_LIMITS.indie.onDemand?.runDaily.limit ?? 0) + 1;

const READ_ROUTES = [
  '/apps',
  '/actions',
  '/actions/summary',
  '/portfolio',
  '/jobs/budget',
  '/auth/tokens',
  '/auth/plan',
  '/workspace/team',
  '/billing/catalog',
];

function sessionCookie(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = raw?.find((entry) => entry.startsWith('asobeast_session='));
  if (!cookie) throw new Error('no session cookie set');
  return cookie.split(';')[0];
}

describe('Self hosted deployments carry no plan gating', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let cookie: string;
  let ownerId: string;

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
  }, 60_000);

  beforeEach(async () => {
    await clearRateLimitCounters(app);
    await clearOnDemandCounters(app);
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "User" RESTART IDENTITY CASCADE',
    );
    await prisma.workspace.update({
      where: { id: DEFAULT_WORKSPACE_ID },
      data: {
        plan: 'free',
        trialStartedAt: null,
        trialEndsAt: null,
        planExpiresAt: null,
        subscriptionStatus: null,
        suspendedAt: null,
        suspendedReason: null,
        deletionRequestedAt: null,
        deletionDueAt: null,
        abuseFlaggedAt: null,
      },
    });

    const register = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'owner@example.com', password: 'supersecret1' })
      .expect(201);
    cookie = sessionCookie(register);
    ownerId = (register.body as AuthUser).id;
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "User" RESTART IDENTITY CASCADE',
    );
    await obliterateQueues(app);
    await app.close();
    restoreAuthEnv();
    await prisma.$disconnect();
  });

  const seedApps = (count: number) =>
    prisma.app.createMany({
      data: Array.from({ length: count }, (_, index) => ({
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: `self-hosted-${index}`,
        country: 'us',
      })),
    });

  it('stamps no trial and leaves the workspace on no plan at all', async () => {
    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: DEFAULT_WORKSPACE_ID },
    });

    expect(workspace.plan).toBe('free');
    expect(workspace.trialEndsAt).toBeNull();
    expect(workspace.planExpiresAt).toBeNull();

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookie)
      .expect(200);
    expect((me.body as AuthUser).entitled).toBe(true);
  });

  it('reports no plan to buy and no metered limit to hit', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/plan')
      .set('Cookie', cookie)
      .expect(200);
    const plan = response.body as AccountPlan;

    expect(plan).toMatchObject({
      billing: false,
      entitled: true,
      upgradeTo: null,
      trialEndsAt: null,
      renewsAt: null,
    });
    expect(plan.limits).toMatchObject({
      apps: null,
      keywordMarkets: null,
      apiRequestsPerMinute: null,
      apiWritesPerMinute: null,
      apiRequestsPerDay: null,
      apiConcurrentRequests: null,
      mcpRequestsPerMinute: null,
      onDemand: null,
    });
    expect(plan.usage.apps.limit).toBeNull();
    expect(plan.usage.keywordMarkets.limit).toBeNull();
  });

  it('omits the plan quota from the daily budget', async () => {
    const budget = await request(app.getHttpServer())
      .get('/jobs/budget')
      .set('Cookie', cookie)
      .expect(200);

    expect((budget.body as DailyBudget).quota).toBeNull();
  });

  it('tracks more apps than the paid entry plan allows', async () => {
    await seedApps(PAST_INDIE_APPS);

    const apps = await request(app.getHttpServer())
      .get('/apps')
      .set('Cookie', cookie)
      .expect(200);
    expect(apps.body).toHaveLength(PAST_INDIE_APPS);

    const plan = await request(app.getHttpServer())
      .get('/auth/plan')
      .set('Cookie', cookie)
      .expect(200);
    expect((plan.body as AccountPlan).usage.apps).toEqual({
      used: PAST_INDIE_APPS,
      limit: null,
    });
  });

  it('never rate limits an on-demand action', async () => {
    await seedApps(1);
    const created = await prisma.app.findFirstOrThrow({ select: { id: true } });

    for (let attempt = 0; attempt < PAST_INDIE_RUNS; attempt++) {
      await request(app.getHttpServer())
        .post(`/apps/${created.id}/run-daily`)
        .set('Cookie', cookie)
        .expect(202);
    }
  });

  it.each(READ_ROUTES)('serves %s without a paywall', async (route) => {
    await request(app.getHttpServer())
      .get(route)
      .set('Cookie', cookie)
      .expect(200);
  });

  it('serves a personal api token the same surface as a session', async () => {
    const plaintext = `asob_${'c'.repeat(48)}`;
    await prisma.apiToken.create({
      data: {
        userId: ownerId,
        name: 'self-hosted',
        tokenHash: sha256(plaintext),
        prefix: plaintext.slice(0, 12),
      },
    });

    for (const route of READ_ROUTES) {
      await request(app.getHttpServer())
        .get(route)
        .set('Authorization', `Bearer ${plaintext}`)
        .expect(200);
    }
  });
});
