import './helpers/enable-billing';
import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import { PLAN_LIMITS } from '@asobeast/shared';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AppsService } from '../src/apps/apps.service';
import { CompetitorsService } from '../src/competitors/competitors.service';
import { KeywordsService } from '../src/keywords/keywords.service';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { QuotaExceededError } from '../src/auth/quota.errors';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { NormalizedApp, StoreProvider } from '../src/store-providers/types';
import { asWorkspace } from './helpers/tenancy';
import { testDb } from './helpers/test-db';
import {
  clearOnDemandCounters,
  clearRateLimitCounters,
  obliterateQueues,
  pauseQueues,
} from './obliterate-queues';
import { restoreAuthEnv } from './helpers/auth-env';

const FIXTURE: NormalizedApp = {
  store: Store.APP_STORE,
  storeAppId: '1',
  title: 'Fixture App',
  description: 'Fixture description',
  raw: { source: 'fixture' },
};

class SlowRegistry {
  get(store: Store): StoreProvider {
    return {
      store,
      getApp: (storeAppId: string) =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ ...FIXTURE, storeAppId }), 20),
        ),
      search: () => Promise.resolve([]),
      suggest: () => Promise.resolve([]),
      similar: () => Promise.resolve([]),
      availability: (_id: string, countries: string[]) =>
        Promise.resolve(
          countries.map((country) => ({
            country,
            status: 'available' as const,
          })),
        ),
    } as unknown as StoreProvider;
  }
}

const settledOf = async <T>(
  work: Promise<T>[],
): Promise<{ fulfilled: number; refused: number }> => {
  const settled = await Promise.allSettled(work);
  return {
    fulfilled: settled.filter((entry) => entry.status === 'fulfilled').length,
    refused: settled.filter(
      (entry) =>
        entry.status === 'rejected' &&
        entry.reason instanceof QuotaExceededError,
    ).length,
  };
};

describe('Quota admission under concurrency (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let apps: AppsService;
  let competitors: CompetitorsService;
  let keywords: KeywordsService;

  const appUrl = (id: string) =>
    `https://apps.apple.com/us/app/fixture/id${id}`;

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StoreProviderRegistry)
      .useValue(new SlowRegistry())
      .compile();

    app = moduleFixture.createNestApplication<App>();
    await app.init();
    await pauseQueues(app);

    apps = app.get(AppsService);
    competitors = app.get(CompetitorsService);
    keywords = app.get(KeywordsService);

    prisma = testDb();
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: { plan: 'indie' },
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default', plan: 'indie' },
    });
  });

  beforeEach(async () => {
    await clearRateLimitCounters(app);
    await clearOnDemandCounters(app);
    await prisma.workspace.update({
      where: { id: DEFAULT_WORKSPACE_ID },
      data: {
        plan: 'indie',
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
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword", "User" RESTART IDENTITY CASCADE',
    );
    await prisma.user.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        email: 'owner@example.com',
        passwordHash: 'x',
        role: 'owner',
      },
    });
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword", "User" RESTART IDENTITY CASCADE',
    );
    await obliterateQueues(app);
    await app.close();
    restoreAuthEnv();
    await prisma.$disconnect();
  });

  it('lets exactly one of two imports take the last app slot', async () => {
    const limit = PLAN_LIMITS.indie.apps;
    await prisma.app.createMany({
      data: Array.from({ length: limit - 1 }, (_, index) => ({
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: `seed-${index}`,
        country: 'us',
      })),
    });

    const outcome = await asWorkspace(app, () =>
      settledOf([
        apps.importFromUrl(appUrl('900')),
        apps.importFromUrl(appUrl('901')),
      ]),
    );

    expect(outcome).toEqual({ fulfilled: 1, refused: 1 });
    expect(await prisma.app.count({ where: { isCompetitor: false } })).toBe(
      limit,
    );
  });

  it('never lets a burst of imports cross the app limit', async () => {
    const limit = PLAN_LIMITS.indie.apps;
    const free = 2;
    await prisma.app.createMany({
      data: Array.from({ length: limit - free }, (_, index) => ({
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: `seed-${index}`,
        country: 'us',
      })),
    });

    const racers = free + 2;
    const outcome = await asWorkspace(app, () =>
      settledOf(
        Array.from({ length: racers }, (_, index) =>
          apps.importFromUrl(appUrl(`70${index}`)),
        ),
      ),
    );

    expect(outcome).toEqual({ fulfilled: free, refused: racers - free });
    expect(await prisma.app.count({ where: { isCompetitor: false } })).toBe(
      limit,
    );
  });

  it('never lets a burst of competitors cross the per-app limit', async () => {
    const limit = PLAN_LIMITS.indie.competitorsPerApp;
    const primary = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: 'primary',
        country: 'us',
      },
      select: { id: true },
    });

    const free = 2;
    await prisma.app.createMany({
      data: Array.from({ length: limit - free }, (_, index) => ({
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: `seeded-rival-${index}`,
        country: 'us',
        isCompetitor: true,
        primaryAppId: primary.id,
      })),
    });

    const racers = free + 2;
    const outcome = await asWorkspace(app, () =>
      settledOf(
        Array.from({ length: racers }, (_, index) =>
          competitors.add(primary.id, appUrl(`80${index}`)),
        ),
      ),
    );

    expect(outcome).toEqual({ fulfilled: free, refused: racers - free });
    expect(
      await prisma.app.count({
        where: { primaryAppId: primary.id, isCompetitor: true },
      }),
    ).toBe(limit);
  });

  it('survives a restart, because no reservation lives in this process', async () => {
    const limit = PLAN_LIMITS.indie.apps;
    await prisma.app.createMany({
      data: Array.from({ length: limit }, (_, index) => ({
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: `full-${index}`,
        country: 'us',
      })),
    });

    await expect(
      asWorkspace(app, () => apps.importFromUrl(appUrl('999'))),
    ).rejects.toBeInstanceOf(QuotaExceededError);
  });

  it('counts a keyword field write against the same limit as a bulk add', async () => {
    const primary = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: 'fielded',
        country: 'us',
      },
      select: { id: true },
    });
    await prisma.workspace.update({
      where: { id: DEFAULT_WORKSPACE_ID },
      data: { plan: 'indie' },
    });

    const text = Array.from(
      { length: PLAN_LIMITS.indie.keywordMarkets + 2 },
      (_, index) => `phrase ${index}`,
    ).join(',');

    await expect(
      asWorkspace(app, () => keywords.setKeywordField(primary.id, text)),
    ).rejects.toBeInstanceOf(QuotaExceededError);

    expect(await prisma.trackedKeyword.count()).toBe(0);
  });

  it('keeps a bulk keyword add whole rather than filling to the limit', async () => {
    const primary = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: 'keyworded',
        country: 'us',
      },
      select: { id: true },
    });
    await prisma.workspace.update({
      where: { id: DEFAULT_WORKSPACE_ID },
      data: { plan: 'indie' },
    });

    const phrases = Array.from(
      { length: PLAN_LIMITS.indie.keywordMarkets + 2 },
      (_, index) => `phrase ${index}`,
    );

    await expect(
      asWorkspace(app, () => keywords.addManual(primary.id, phrases)),
    ).rejects.toBeInstanceOf(QuotaExceededError);

    expect(await prisma.trackedKeyword.count()).toBe(0);
  });
});
