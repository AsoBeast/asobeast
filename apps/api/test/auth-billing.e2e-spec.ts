import './helpers/enable-billing';
import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import cookieParser from 'cookie-parser';
import {
  AccountPlan,
  ApiErrorEnvelope,
  AuthUser,
  DailyBudget,
  PLAN_LIMITS,
  UPGRADE_PATH,
} from '@asobeast/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { testDb } from './helpers/test-db';
import {
  clearOnDemandCounters,
  clearRateLimitCounters,
  obliterateQueues,
  pauseQueues,
} from './obliterate-queues';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { sha256 } from '../src/auth/password-hash';
import { ActiveWorkspaces } from '../src/jobs/active-workspaces';
import { restoreAuthEnv } from './helpers/auth-env';

const DAY_MS = 24 * 60 * 60 * 1000;

function sessionCookie(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = raw?.find((entry) => entry.startsWith('asobeast_session='));
  if (!cookie) throw new Error('no session cookie set');
  return cookie.split(';')[0];
}

describe('Auth (billing mode)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;

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
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App" RESTART IDENTITY CASCADE',
    );
    await prisma.workspace.deleteMany({
      where: { id: { not: DEFAULT_WORKSPACE_ID } },
    });
    await prisma.workspace.update({
      where: { id: DEFAULT_WORKSPACE_ID },
      data: {
        plan: 'free',
        trialStartedAt: null,
        trialEndsAt: null,
        planExpiresAt: null,
      },
    });
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "User" RESTART IDENTITY CASCADE',
    );
    await obliterateQueues(app);
    await app.close();
    restoreAuthEnv();
    await prisma.$disconnect();
  });

  it('keeps registration open and stamps a seven day trial', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'first@example.com', password: 'supersecret1' })
      .expect(201);

    const register = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'second@example.com', password: 'supersecret1' })
      .expect(201);
    const created = register.body as AuthUser;

    expect(created.trialEndsAt).not.toBeNull();
    const trialEndsAt = new Date(created.trialEndsAt as string).getTime();
    expect(Math.abs(trialEndsAt - (Date.now() + 7 * DAY_MS))).toBeLessThan(
      60 * 1000,
    );
    expect(created.entitled).toBe(true);
  });

  it('rejects a duplicate email with 409 while registration is open', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'dupe@example.com', password: 'supersecret1' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'Dupe@Example.com', password: 'anothersecret1' })
      .expect(409);
  });

  const registerOwner = async (): Promise<{
    cookie: string;
    id: string;
    workspaceId: string;
  }> => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'owner@example.com', password: 'supersecret1' })
      .expect(201);
    const id = (res.body as AuthUser).id;
    const { workspaceId } = await prisma.user.findUniqueOrThrow({
      where: { id },
      select: { workspaceId: true },
    });
    return { cookie: sessionCookie(res), id, workspaceId };
  };

  const setEntitlement = (
    workspaceId: string,
    data: {
      plan?: string;
      trialEndsAt?: Date | null;
      planExpiresAt?: Date | null;
    },
  ) => prisma.workspace.update({ where: { id: workspaceId }, data });

  it('bootstraps exactly one account into the default workspace when registrations race', async () => {
    const register = (email: string) =>
      request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'supersecret1' });

    const responses = await Promise.all([
      register('racer-a@example.com'),
      register('racer-b@example.com'),
      register('racer-c@example.com'),
    ]);

    expect(responses.map((res) => res.status)).toEqual([201, 201, 201]);
    const users = await prisma.user.findMany({
      select: { role: true, workspaceId: true },
    });
    expect(
      users.filter((user) => user.workspaceId === DEFAULT_WORKSPACE_ID),
    ).toHaveLength(1);
    expect(new Set(users.map((user) => user.workspaceId)).size).toBe(
      users.length,
    );
    expect(users.every((user) => user.role === 'owner')).toBe(true);
  });

  it('leaves no orphan workspace when a duplicate email loses the race', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'first@example.com', password: 'supersecret1' })
      .expect(201);
    const before = await prisma.workspace.count();

    const duplicate = () =>
      request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'orphan@example.com', password: 'supersecret1' });
    const statuses = await Promise.all([duplicate(), duplicate()]).then(
      (responses) => responses.map((res) => res.status).sort(),
    );

    expect(statuses).toEqual([201, 409]);
    await expect(
      prisma.user.count({ where: { email: 'orphan@example.com' } }),
    ).resolves.toBe(1);
    expect(await prisma.workspace.count()).toBe(before + 1);
  });

  it('never grants a workspace a second trial', async () => {
    const { workspaceId } = await registerOwner();
    const started = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { trialStartedAt: true },
    });
    expect(started.trialStartedAt).not.toBeNull();

    await setEntitlement(workspaceId, {
      trialEndsAt: new Date(Date.now() - DAY_MS),
    });
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "User" RESTART IDENTITY CASCADE',
    );
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'owner@example.com', password: 'supersecret1' })
      .expect(201);

    const after = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { trialStartedAt: true, trialEndsAt: true },
    });
    expect(after.trialStartedAt).toEqual(started.trialStartedAt);
    expect(after.trialEndsAt!.getTime()).toBeLessThan(Date.now());
  });

  it('makes every hosted registration the owner of its own trialing workspace', async () => {
    await registerOwner();
    const second = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'tenant@example.com', password: 'supersecret1' })
      .expect(201);

    const tenant = await prisma.user.findUniqueOrThrow({
      where: { id: (second.body as AuthUser).id },
      select: { role: true, workspace: true },
    });
    expect(tenant.role).toBe('owner');
    expect(tenant.workspace.id).not.toBe(DEFAULT_WORKSPACE_ID);
    expect(tenant.workspace.trialEndsAt).not.toBeNull();
    expect(tenant.workspace.trialStartedAt).not.toBeNull();
    expect(tenant.workspace.plan).toBe('trial');
  });

  it('gives a hosted account its own workspace and hides the first one', async () => {
    await registerOwner();
    const second = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'tenant@example.com', password: 'supersecret1' })
      .expect(201);
    await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: 'owned-by-the-first-account',
        country: 'us',
      },
    });

    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: { email: true, workspaceId: true },
    });
    expect(users.map((user) => user.email)).toEqual([
      'owner@example.com',
      'tenant@example.com',
    ]);
    expect(users[0].workspaceId).toBe(DEFAULT_WORKSPACE_ID);
    expect(users[1].workspaceId).not.toBe(DEFAULT_WORKSPACE_ID);

    const apps = await request(app.getHttpServer())
      .get('/apps')
      .set('Cookie', sessionCookie(second))
      .expect(200);
    expect(apps.body).toEqual([]);
  });

  it('grants a fresh trial account full access', async () => {
    const { cookie } = await registerOwner();
    await request(app.getHttpServer())
      .get('/apps')
      .set('Cookie', cookie)
      .expect(200);
  });

  it('reports the plan, its limits and usage against them', async () => {
    const { cookie, workspaceId } = await registerOwner();
    await prisma.app.create({
      data: {
        workspaceId,
        store: Store.APP_STORE,
        storeAppId: 'plan-usage',
        country: 'us',
      },
    });

    const response = await request(app.getHttpServer())
      .get('/auth/plan')
      .set('Cookie', cookie)
      .expect(200);

    expect(response.body as AccountPlan).toMatchObject({
      plan: 'trial',
      displayName: 'Trial',
      billing: true,
      entitled: true,
      upgradeTo: 'indie',
      upgradePath: UPGRADE_PATH,
      limits: PLAN_LIMITS.trial,
      usage: {
        apps: { used: 1, limit: PLAN_LIMITS.trial.apps },
        keywordMarkets: { used: 0, limit: PLAN_LIMITS.trial.keywordMarkets },
      },
    });
  });

  it('names the plan and the upgrade route in the 402 envelope', async () => {
    const { cookie, workspaceId } = await registerOwner();
    const trialEndsAt = new Date(Date.now() - DAY_MS);
    await setEntitlement(workspaceId, { trialEndsAt });

    const refused = await request(app.getHttpServer())
      .post('/apps')
      .set('Cookie', cookie)
      .send({ url: 'https://apps.apple.com/us/app/new/id999' })
      .expect(402);

    expect((refused.body as ApiErrorEnvelope).entitlement).toEqual({
      plan: 'free',
      trialEndsAt: trialEndsAt.toISOString(),
      planExpiresAt: null,
      upgradeTo: 'indie',
      upgradePath: UPGRADE_PATH,
    });
  });

  it('keeps the plan endpoint reachable once the trial has lapsed', async () => {
    const { cookie, workspaceId } = await registerOwner();
    await setEntitlement(workspaceId, {
      trialEndsAt: new Date(Date.now() - DAY_MS),
    });

    const response = await request(app.getHttpServer())
      .get('/auth/plan')
      .set('Cookie', cookie)
      .expect(200);

    expect(response.body as AccountPlan).toMatchObject({
      plan: 'free',
      entitled: false,
      upgradeTo: 'indie',
    });
  });

  it('drops a lapsed workspace from the daily run without touching its data', async () => {
    const { workspaceId } = await registerOwner();
    const created = await prisma.app.create({
      data: {
        workspaceId,
        store: Store.APP_STORE,
        storeAppId: 'still-here',
        country: 'us',
      },
      select: { id: true },
    });
    const roster = app.get(ActiveWorkspaces);

    await expect(roster.forDailyRun()).resolves.toContain(workspaceId);

    await setEntitlement(workspaceId, {
      trialEndsAt: new Date(Date.now() - DAY_MS),
    });

    await expect(roster.forDailyRun()).resolves.not.toContain(workspaceId);
    await expect(
      prisma.app.findUnique({ where: { id: created.id } }),
    ).resolves.not.toBeNull();
  });

  it('locks a lapsed trial out of capacity but leaves its data readable', async () => {
    const { cookie, workspaceId } = await registerOwner();
    const created = await prisma.app.create({
      data: {
        workspaceId,
        store: Store.APP_STORE,
        storeAppId: 'lapsed-but-mine',
        country: 'us',
      },
      select: { id: true },
    });
    await setEntitlement(workspaceId, {
      trialEndsAt: new Date(Date.now() - DAY_MS),
    });

    const apps = await request(app.getHttpServer())
      .get('/apps')
      .set('Cookie', cookie)
      .expect(200);
    expect(apps.body).toHaveLength(1);

    await request(app.getHttpServer())
      .post('/apps')
      .set('Cookie', cookie)
      .send({ url: 'https://apps.apple.com/us/app/new/id999' })
      .expect(402);

    await request(app.getHttpServer())
      .post(`/apps/${created.id}/run-daily`)
      .set('Cookie', cookie)
      .expect(402);

    for (const spends of [
      `/apps/${created.id}/keywords/suggestions?strategy=metadata`,
      `/apps/${created.id}/market-availability?country=de`,
    ]) {
      await request(app.getHttpServer())
        .get(spends)
        .set('Cookie', cookie)
        .expect(402);
    }

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookie)
      .expect(200);
    expect((me.body as AuthUser).entitled).toBe(false);
  });

  it('restores access when the plan is set to premium', async () => {
    const { cookie, workspaceId } = await registerOwner();
    const created = await prisma.app.create({
      data: {
        workspaceId,
        store: Store.APP_STORE,
        storeAppId: 'premium-restored',
        country: 'us',
      },
      select: { id: true },
    });
    await setEntitlement(workspaceId, {
      trialEndsAt: new Date(Date.now() - DAY_MS),
      plan: 'premium',
    });
    const runDaily = () =>
      request(app.getHttpServer())
        .post(`/apps/${created.id}/run-daily`)
        .set('Cookie', cookie);

    await runDaily().expect(202);

    await setEntitlement(workspaceId, {
      planExpiresAt: new Date(Date.now() - DAY_MS),
    });

    await runDaily().expect(402);
  });

  it('keeps an ultimate account entitled once its trial has lapsed', async () => {
    const { cookie, workspaceId } = await registerOwner();
    await setEntitlement(workspaceId, {
      trialEndsAt: new Date(Date.now() - DAY_MS),
      plan: 'ultimate',
    });

    await request(app.getHttpServer())
      .get('/apps')
      .set('Cookie', cookie)
      .expect(200);

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookie)
      .expect(200);
    expect((me.body as AuthUser).entitled).toBe(true);
  });

  it('gives an ultimate account the larger app quota it pays for', async () => {
    const { cookie, workspaceId } = await registerOwner();
    await setEntitlement(workspaceId, {
      trialEndsAt: new Date(Date.now() - DAY_MS),
      plan: 'ultimate',
    });
    await prisma.app.createMany({
      data: Array.from({ length: 5 }, (_, index) => ({
        workspaceId,
        store: Store.APP_STORE,
        storeAppId: `ultimate-${index}`,
        country: 'us',
      })),
    });

    const budget = await request(app.getHttpServer())
      .get('/jobs/budget')
      .set('Cookie', cookie)
      .expect(200);
    expect((budget.body as DailyBudget).quota).toMatchObject({
      plan: 'ultimate',
      apps: { used: 5, limit: 50 },
    });
  });

  it('reports the limits of whichever plan the workspace is on', async () => {
    const { cookie, workspaceId } = await registerOwner();
    const quotaOf = async () => {
      const budget = await request(app.getHttpServer())
        .get('/jobs/budget')
        .set('Cookie', cookie)
        .expect(200);
      return (budget.body as DailyBudget).quota;
    };

    await setEntitlement(workspaceId, { plan: 'ultimate' });
    expect(await quotaOf()).toMatchObject({
      plan: 'ultimate',
      apps: { limit: PLAN_LIMITS.ultimate.apps },
      keywordMarkets: { limit: PLAN_LIMITS.ultimate.keywordMarkets },
    });

    await setEntitlement(workspaceId, { plan: 'indie' });
    expect(await quotaOf()).toMatchObject({
      plan: 'indie',
      apps: { limit: PLAN_LIMITS.indie.apps },
      keywordMarkets: { limit: PLAN_LIMITS.indie.keywordMarkets },
    });
  });

  it('refuses an import past the plan app limit with a typed quota envelope', async () => {
    const { cookie, workspaceId } = await registerOwner();
    await prisma.app.createMany({
      data: Array.from({ length: 5 }, (_, index) => ({
        workspaceId,
        store: Store.APP_STORE,
        storeAppId: `10${index}`,
        country: 'us',
      })),
    });

    const response = await request(app.getHttpServer())
      .post('/apps')
      .set('Cookie', cookie)
      .send({ url: 'https://apps.apple.com/us/app/new/id999' })
      .expect(403);
    const envelope = response.body as ApiErrorEnvelope;

    expect(envelope.quota).toEqual({
      resource: 'apps',
      plan: 'trial',
      limit: 5,
      used: 5,
      requested: 1,
      upgradeTo: 'indie',
    });
  });

  it('answers an exhausted on-demand limit with Retry-After alongside the envelope', async () => {
    await registerOwner();
    const tenant = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'limited@example.com', password: 'supersecret1' })
      .expect(201);
    const cookie = sessionCookie(tenant);
    const { workspaceId } = await prisma.user.findUniqueOrThrow({
      where: { id: (tenant.body as AuthUser).id },
      select: { workspaceId: true },
    });
    const created = await prisma.app.create({
      data: {
        workspaceId,
        store: Store.APP_STORE,
        storeAppId: 'rate-limited',
        country: 'us',
      },
      select: { id: true },
    });

    const runDaily = () =>
      request(app.getHttpServer())
        .post(`/apps/${created.id}/run-daily`)
        .set('Cookie', cookie);

    const limit = PLAN_LIMITS.indie.onDemand?.runDaily.limit ?? 0;
    for (let attempt = 0; attempt < limit; attempt++) {
      await runDaily().expect(202);
    }

    const refused = await runDaily().expect(429);
    const envelope = refused.body as ApiErrorEnvelope;
    expect(envelope.retryAfterSeconds).toBeGreaterThan(0);
    expect(refused.headers['retry-after']).toBe(
      String(envelope.retryAfterSeconds),
    );
  });

  it.each([
    ['a lapsed trial', { trialEndsAt: new Date(Date.now() - DAY_MS) }],
    [
      'an expired subscription',
      {
        plan: 'indie',
        trialEndsAt: new Date(Date.now() - DAY_MS),
        planExpiresAt: new Date(Date.now() - DAY_MS),
      },
    ],
  ])('always leaves %s a way to reach billing', async (_case, data) => {
    const { cookie, workspaceId } = await registerOwner();
    await setEntitlement(workspaceId, data);

    for (const route of ['/auth/me', '/auth/plan', '/billing/catalog']) {
      await request(app.getHttpServer())
        .get(route)
        .set('Cookie', cookie)
        .expect(200);
    }
  });

  it('locks every api-token read from an unentitled workspace', async () => {
    const { id, workspaceId } = await registerOwner();
    await setEntitlement(workspaceId, {
      trialEndsAt: new Date(Date.now() - DAY_MS),
    });
    const plaintext = `asob_${'b'.repeat(48)}`;
    await prisma.apiToken.create({
      data: {
        userId: id,
        name: 'ci',
        tokenHash: sha256(plaintext),
        prefix: plaintext.slice(0, 12),
      },
    });

    await request(app.getHttpServer())
      .get('/apps')
      .set('Authorization', `Bearer ${plaintext}`)
      .expect(402);
  });
});
