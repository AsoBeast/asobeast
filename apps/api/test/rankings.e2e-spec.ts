import { execSync } from 'child_process';
import { join } from 'path';
import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import {
  ApiErrorEnvelope,
  SerpEntrantPayload,
  SerpMovers,
} from '@asobeast/shared';
import { Queue } from 'bullmq';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { asWorkspace } from './helpers/tenancy';
import { testDb } from './helpers/test-db';
import { ownerAgent, useCookies } from './helpers/session';
import { obliterateQueues, pauseQueues } from './obliterate-queues';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { QUEUES } from '../src/jobs/jobs.types';
import { RankingsService } from '../src/rankings/rankings.service';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { SearchItem, StoreProvider } from '../src/store-providers/types';

function utcMidnight(offsetDays: number): Date {
  const now = new Date();
  const date = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  date.setUTCDate(date.getUTCDate() - offsetDays);
  return date;
}

describe('RankingsController serp-movers (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    useCookies(app);
    await app.init();

    prisma = testDb();
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
    api = await ownerAgent(app);
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  it('returns a 404 envelope for an unknown app id', async () => {
    const response = await api.get('/apps/missing/serp-movers').expect(404);

    const body = response.body as ApiErrorEnvelope;
    expect(body.statusCode).toBe(404);
    expect(body.path).toBe('/apps/missing/serp-movers');
    expect(typeof body.message).toBe('string');
  });

  it('lists entrants excluding the first day and annotates known apps', async () => {
    const you = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: 'self-store',
        country: 'us',
        name: 'You',
      },
    });
    const rival = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: 'rival-store',
        country: 'us',
        name: 'Rival',
        isCompetitor: true,
        primaryAppId: you.id,
      },
    });
    const keyword = await prisma.keyword.create({
      data: { text: 'habit tracker', store: Store.APP_STORE, country: 'us' },
    });
    await prisma.trackedKeyword.create({
      data: {
        appId: you.id,
        keywordId: keyword.id,
        source: 'MANUAL',
        active: true,
      },
    });

    const day1 = utcMidnight(1);
    const day2 = utcMidnight(0);
    await prisma.serpEntry.createMany({
      data: [
        {
          keywordId: keyword.id,
          date: day1,
          position: 1,
          storeAppId: 'self-store',
          title: 'You',
        },
        {
          keywordId: keyword.id,
          date: day2,
          position: 1,
          storeAppId: 'self-store',
          title: 'You',
        },
        {
          keywordId: keyword.id,
          date: day2,
          position: 2,
          storeAppId: 'rival-store',
          title: 'Rival',
        },
        {
          keywordId: keyword.id,
          date: day2,
          position: 3,
          storeAppId: 'stranger-store',
          title: 'Stranger',
        },
      ],
    });

    const response = await api
      .get(`/apps/${you.id}/serp-movers?days=30`)
      .expect(200);

    const body = response.body as SerpMovers;
    expect(body.windowDays).toBe(30);
    expect(body.items).toHaveLength(2);
    expect(body.items.map((item) => item.storeAppId)).toEqual([
      'rival-store',
      'stranger-store',
    ]);
    expect(body.items[0]).toMatchObject({
      date: day2.toISOString().slice(0, 10),
      position: 2,
      appId: rival.id,
      isCompetitor: true,
      text: 'habit tracker',
    });
    expect(body.items[1]).toMatchObject({
      appId: null,
      isCompetitor: false,
    });
  });
});

describe('RankingsService serp entrant alerts (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let rankings: RankingsService;
  let alertsQueue: Queue;

  const SERP: SearchItem[] = [
    { storeAppId: 'self-store', title: 'You' },
    { storeAppId: 'newcomer-store', title: 'Newcomer' },
  ];

  const registry = {
    get: (): StoreProvider =>
      ({ search: () => Promise.resolve(SERP) }) as unknown as StoreProvider,
  };

  const seedKeyword = async (): Promise<string> => {
    const you = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: 'self-store',
        country: 'us',
        name: 'You',
      },
    });
    const keyword = await prisma.keyword.create({
      data: { text: 'habit tracker', store: Store.APP_STORE, country: 'us' },
    });
    await prisma.trackedKeyword.create({
      data: {
        appId: you.id,
        keywordId: keyword.id,
        source: 'MANUAL',
        active: true,
      },
    });
    return keyword.id;
  };

  const outboxEntrants = (): Promise<{ payload: unknown }[]> =>
    prisma.alertEvent.findMany({
      where: { event: 'serp.entrant' },
      select: { payload: true },
    });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StoreProviderRegistry)
      .useValue(registry)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    await pauseQueues(app);

    prisma = testDb();
    rankings = app.get(RankingsService);
    alertsQueue = app.get<Queue>(getQueueToken(QUEUES.ALERTS), {
      strict: false,
    });
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
  });

  beforeEach(async () => {
    await alertsQueue.drain(true);
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword", "Webhook", "AlertEvent" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await obliterateQueues(app);
    await app.close();
  });

  it('collects nothing on the first ever capture', async () => {
    const keywordId = await seedKeyword();

    await asWorkspace(app, () => rankings.checkKeyword(keywordId));

    expect(await outboxEntrants()).toHaveLength(0);
  });

  it('collects one entrant outbox row for the day', async () => {
    const keywordId = await seedKeyword();
    await prisma.serpEntry.create({
      data: {
        keywordId,
        date: utcMidnight(1),
        position: 1,
        storeAppId: 'self-store',
        title: 'You',
      },
    });

    await asWorkspace(app, () => rankings.checkKeyword(keywordId));

    const rows = await outboxEntrants();
    expect(rows).toHaveLength(1);
    expect((rows[0].payload as SerpEntrantPayload).entrants).toEqual([
      {
        position: 2,
        storeAppId: 'newcomer-store',
        title: 'Newcomer',
        appId: null,
        isCompetitor: false,
      },
    ]);
  });
});
