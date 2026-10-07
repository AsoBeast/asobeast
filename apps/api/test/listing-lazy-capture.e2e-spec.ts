import { execSync } from 'child_process';
import { join } from 'path';
import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import { Queue } from 'bullmq';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { JOBS, QUEUES } from '../src/jobs/jobs.types';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { StoreProvider } from '../src/store-providers/types';
import { obliterateQueues, pauseQueues } from './obliterate-queues';
import { testDb } from './helpers/test-db';
import { ownerAgent, useCookies } from './helpers/session';

const registry = {
  get: (store: Store): StoreProvider => ({
    store,
    getApp: () => Promise.reject(new Error('no store request in this test')),
    search: () => Promise.resolve([]),
    suggest: () => Promise.resolve([]),
    similar: () => Promise.resolve([]),
    topCharts: () => Promise.resolve([]),
    reviews: () => Promise.resolve([]),
    availability: () => Promise.resolve([]),
    developerApps: () => Promise.resolve([]),
  }),
};

describe('listing capture on the first keyword of a market (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;

  const marketRefreshes = async () =>
    (
      await app
        .get<Queue>(getQueueToken(QUEUES.APP_STORE), { strict: false })
        .getJobs(['wait', 'delayed'])
    )
      .filter((job) => job.name === JOBS.REFRESH_APP)
      .map((job) => job.data as { appId: string; country?: string })
      .filter((data) => data.country !== undefined);

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
      .useValue(registry)
      .compile();
    app = moduleFixture.createNestApplication();
    useCookies(app);
    await app.init();
    await pauseQueues(app);
    prisma = testDb();
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
    api = await ownerAgent(app);
  });

  beforeEach(async () => {
    await obliterateQueues(app);
    await pauseQueues(app);
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const seed = async () => {
    const primary = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '111',
        country: 'us',
        name: 'Mine',
      },
    });
    const rival = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '222',
        country: 'us',
        name: 'Rival',
        isCompetitor: true,
        primaryAppId: primary.id,
      },
    });
    return { primary, rival };
  };

  const addKeywords = (appId: string, keywords: string[], country?: string) =>
    api
      .post(`/apps/${appId}/keywords`)
      .send({ keywords, ...(country ? { country } : {}) })
      .expect(201);

  it('asks for the listing of a market on its first keyword', async () => {
    const { primary, rival } = await seed();

    await addKeywords(primary.id, ['gewohnheit'], 'de');

    const jobs = await marketRefreshes();
    expect(jobs.map((data) => data.appId).sort()).toEqual(
      [primary.id, rival.id].sort(),
    );
    expect(jobs.every((data) => data.country === 'de')).toBe(true);
  });

  it('asks only once for a second keyword in the same market', async () => {
    const { primary } = await seed();

    await addKeywords(primary.id, ['gewohnheit'], 'de');
    await addKeywords(primary.id, ['schlaf'], 'de');

    await expect(marketRefreshes()).resolves.toHaveLength(2);
  });

  it('asks for the listing when a paused market keyword resumes', async () => {
    const { primary, rival } = await seed();
    const keyword = await prisma.keyword.create({
      data: { text: 'gewohnheit', store: Store.APP_STORE, country: 'de' },
    });
    await prisma.trackedKeyword.create({
      data: {
        appId: primary.id,
        keywordId: keyword.id,
        source: 'MANUAL',
        active: false,
      },
    });

    await api
      .patch(`/apps/${primary.id}/keywords/${keyword.id}`)
      .send({ active: true })
      .expect(200);

    const jobs = await marketRefreshes();
    expect(jobs.map((data) => data.appId).sort()).toEqual(
      [primary.id, rival.id].sort(),
    );
    expect(jobs.every((data) => data.country === 'de')).toBe(true);
  });

  it('asks for nothing when the keyword is in the home market', async () => {
    const { primary } = await seed();

    await addKeywords(primary.id, ['habit tracker']);

    await expect(marketRefreshes()).resolves.toEqual([]);
  });
});
