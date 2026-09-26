import { execSync } from 'child_process';
import { join } from 'path';
import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import {
  AlertBatchPayload,
  ApiErrorEnvelope,
  SerpEntrantPayload,
  SerpMovers,
} from '@asobeast/shared';
import { Queue } from 'bullmq';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AlertFlushService } from '../src/alerts/alert-flush.service';
import { asWorkspace } from './helpers/tenancy';
import { testDb } from './helpers/test-db';
import { ownerAgent, useCookies } from './helpers/session';
import { obliterateQueues, pauseQueues } from './obliterate-queues';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { DeliverAlertPayload, QUEUES } from '../src/jobs/jobs.types';
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

  describe('the ranking history window', () => {
    async function appId(): Promise<string> {
      const app = await prisma.app.create({
        data: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          store: Store.APP_STORE,
          storeAppId: 'history-store',
          country: 'us',
          name: 'History',
        },
      });
      return app.id;
    }

    it.each([
      ['a start that is not on the calendar', 'from=2026-09-31'],
      ['an end before the start', 'from=2026-09-15&to=2026-09-01'],
    ])('refuses %s', async (_case, query) => {
      await api.get(`/apps/${await appId()}/rankings?${query}`).expect(400);
    });

    it('accepts a timestamp start with a date end', async () => {
      await api
        .get(
          `/apps/${await appId()}/rankings?from=2026-09-01T00:00:00Z&to=2026-09-15`,
        )
        .expect(200);
    });
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

describe('RankingsService milestone alerts (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let rankings: RankingsService;
  let flush: AlertFlushService;
  let results: SearchItem[] = [];

  const registry = {
    get: (): StoreProvider =>
      ({
        search: () => Promise.resolve(results),
      }) as unknown as StoreProvider,
  };

  const seed = async (): Promise<{
    you: string;
    rival: string;
    keywordId: string;
  }> => {
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
    return { you: you.id, rival: rival.id, keywordId: keyword.id };
  };

  const serpAt = (placements: Record<string, number>): SearchItem[] =>
    Array.from({ length: 40 }, (_, index) => {
      const hit = Object.keys(placements).find(
        (storeAppId) => placements[storeAppId] === index + 1,
      );
      const storeAppId = hit ?? `filler-${index + 1}`;
      return { storeAppId, title: storeAppId };
    });

  const rankedOn = (
    appId: string,
    keywordId: string,
    daysAgo: number,
    position: number | null,
  ) =>
    prisma.keywordRanking.create({
      data: {
        appId,
        workspaceId: DEFAULT_WORKSPACE_ID,
        keywordId,
        date: utcMidnight(daysAgo),
        position,
      },
    });

  const outbox = async () =>
    new Map(
      (
        await prisma.alertEvent.findMany({
          select: { event: true, appId: true, dedupeKey: true, payload: true },
        })
      ).map((row) => [row.event, row]),
    );

  const today = (): string => utcMidnight(0).toISOString().slice(0, 10);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StoreProviderRegistry)
      .useValue(registry)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = testDb();
    rankings = app.get(RankingsService);
    flush = app.get(AlertFlushService);
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
  });

  beforeEach(async () => {
    await obliterateQueues(app);
    await pauseQueues(app);
    results = [];
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword", "Webhook", "AlertEvent" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await obliterateQueues(app);
    await app.close();
  });

  it('collects a milestone beside the rank improvement', async () => {
    const { you, keywordId } = await seed();
    await rankedOn(you, keywordId, 1, 14);
    results = serpAt({ 'self-store': 8 });

    await asWorkspace(app, () => rankings.checkKeyword(keywordId));

    const rows = await outbox();
    expect([...rows.keys()].sort()).toEqual([
      'rank.improved',
      'rank.milestone',
    ]);
    expect(rows.get('rank.improved')?.dedupeKey).toBe(
      `rank:${you}:${keywordId}:${today()}`,
    );
    expect(rows.get('rank.milestone')).toMatchObject({
      appId: you,
      dedupeKey: `milestone:${you}:${keywordId}:${today()}`,
      payload: {
        app: { id: you, name: 'You' },
        tier: 10,
        direction: 'entered',
        from: 14,
        to: 8,
      },
    });
  });

  it('collects a first ranking instead of a milestone', async () => {
    const { you, keywordId } = await seed();
    await rankedOn(you, keywordId, 1, null);
    results = serpAt({ 'self-store': 8 });

    await asWorkspace(app, () => rankings.checkKeyword(keywordId));

    const rows = await outbox();
    expect([...rows.keys()].sort()).toEqual(['rank.first', 'rank.improved']);
    expect(rows.get('rank.first')).toMatchObject({
      dedupeKey: `first:${you}:${keywordId}:${today()}`,
      payload: { position: 8 },
    });
  });

  it('collects a milestone when the app ranked before the previous check', async () => {
    const { you, keywordId } = await seed();
    await rankedOn(you, keywordId, 3, 50);
    await rankedOn(you, keywordId, 1, null);
    results = serpAt({ 'self-store': 8 });

    await asWorkspace(app, () => rankings.checkKeyword(keywordId));

    expect([...(await outbox()).keys()].sort()).toEqual([
      'rank.improved',
      'rank.milestone',
    ]);
  });

  it('collects an overtake keyed on the owned app', async () => {
    const { you, rival, keywordId } = await seed();
    await rankedOn(you, keywordId, 1, 5);
    await rankedOn(rival, keywordId, 1, 9);
    results = serpAt({ 'self-store': 6, 'rival-store': 4 });

    await asWorkspace(app, () => rankings.checkKeyword(keywordId));

    const rows = await outbox();
    expect([...rows.keys()]).toEqual(['rank.overtaken']);
    expect(rows.get('rank.overtaken')).toMatchObject({
      appId: you,
      dedupeKey: `overtaken:${you}:${keywordId}:${rival}:${today()}`,
      payload: {
        competitor: { id: rival, name: 'Rival', from: 9, to: 4 },
        from: 5,
        to: 6,
      },
    });
    expect(await prisma.alertEvent.count({ where: { appId: rival } })).toBe(0);
  });

  it('collects nothing on the first ever capture', async () => {
    const { keywordId } = await seed();
    results = serpAt({ 'self-store': 2, 'rival-store': 1 });

    await asWorkspace(app, () => rankings.checkKeyword(keywordId));

    expect((await outbox()).size).toBe(0);
  });

  it('delivers a milestone only to the channel that lists it', async () => {
    const { you, keywordId } = await seed();
    await rankedOn(you, keywordId, 1, 14);
    const milestones = await prisma.webhook.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        url: 'https://hooks.example.com/milestones',
        events: ['rank.milestone'],
      },
    });
    await prisma.webhook.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        url: 'https://hooks.example.com/reviews',
        events: ['review.negative'],
      },
    });
    results = serpAt({ 'self-store': 8 });

    await asWorkspace(app, () => rankings.checkKeyword(keywordId));
    await asWorkspace(app, () => flush.flush());

    const queue = app.get<Queue<DeliverAlertPayload>>(
      getQueueToken(QUEUES.ALERTS),
      { strict: false },
    );
    const jobs = await queue.getJobs([
      'wait',
      'paused',
      'delayed',
      'waiting-children',
    ]);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].data.webhookId).toBe(milestones.id);
    const batch = jobs[0].data.payload as AlertBatchPayload;
    expect(batch.scope).toBe('owned_apps');
    expect(batch.events.map((payload) => payload.event)).toEqual([
      'rank.milestone',
    ]);
    expect(batch.apps[0].rankMilestones).toEqual([
      expect.objectContaining({ tier: 10, direction: 'entered' }),
    ]);
  });
});
