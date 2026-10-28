import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import type {
  AlertBatchPayload,
  ChartEnteredPayload,
  ChartMilestonePayload,
} from '@asobeast/shared';
import { Queue } from 'bullmq';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AlertFlushService } from '../src/alerts/alert-flush.service';
import {
  addDays,
  toDateKey,
  utcToday,
} from '../src/analytics/analytics.support';
import { CategoryRanksService } from '../src/category-ranks/category-ranks.service';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { DeliverAlertPayload, QUEUES } from '../src/jobs/jobs.types';
import { PrismaService } from '../src/prisma/prisma.service';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { StoreProvider } from '../src/store-providers/types';
import { asWorkspace } from './helpers/tenancy';
import { testDb } from './helpers/test-db';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

const OTHER_WORKSPACE = 'ws_chart_alerts_other';

describe('CategoryRanksService chart alerts (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let ranks: CategoryRanksService;
  let flush: AlertFlushService;
  const topCharts = jest.fn();
  const registry = {
    get: () => ({ topCharts }) as unknown as StoreProvider,
  };

  const seedApp = (
    name: string,
    {
      isCompetitor = false,
      primaryAppId = null,
      workspaceId = DEFAULT_WORKSPACE_ID,
    }: {
      isCompetitor?: boolean;
      primaryAppId?: string | null;
      workspaceId?: string;
    } = {},
  ) =>
    prisma.app.create({
      data: {
        workspaceId,
        store: Store.APP_STORE,
        storeAppId: `${name}-store`,
        country: 'us',
        name,
        isCompetitor,
        primaryAppId,
        iconUrl: `https://is1-ssl.mzstatic.com/image/thumb/${name}.jpg`,
        snapshots: {
          create: {
            title: name,
            description: 'desc',
            raw: {
              primaryGenreId: '6007',
              primaryGenre: 'Productivity',
              price: 0,
            },
          },
        },
      },
    });

  const rankedYesterday = (appId: string, position: number | null) =>
    prisma.categoryRank.create({
      data: {
        appId,
        date: addDays(utcToday(), -1),
        collection: 'free',
        genre: '6007',
        position,
        depth: 100,
      },
    });

  const chartOf = (placements: Record<string, number>) =>
    topCharts.mockReset().mockResolvedValue(
      Array.from({ length: 40 }, (_, index) => {
        const hit = Object.keys(placements).find(
          (storeAppId) => placements[storeAppId] === index + 1,
        );
        const storeAppId = hit ?? `filler-${index + 1}`;
        return { storeAppId, title: storeAppId };
      }),
    );

  const check = (workspaceId = DEFAULT_WORKSPACE_ID) =>
    asWorkspace(
      app,
      () =>
        ranks.checkCategory(
          {
            collection: 'free',
            genre: '6007',
            country: 'us',
            store: 'APP_STORE',
            workspaceId,
          },
          true,
        ),
      workspaceId,
    );

  const outbox = async () =>
    new Map(
      (
        await prisma.alertEvent.findMany({
          select: {
            event: true,
            appId: true,
            dedupeKey: true,
            payload: true,
            workspaceId: true,
            createdAt: true,
          },
        })
      ).map((row) => [row.event, row]),
    );

  const today = (): string => toDateKey(utcToday());

  const todayRank = (appId: string) =>
    prisma.categoryRank.findUnique({
      where: {
        appId_date_collection_genre: {
          appId,
          date: utcToday(),
          collection: 'free',
          genre: '6007',
        },
      },
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

    prisma = testDb();
    ranks = app.get(CategoryRanksService);
    flush = app.get(AlertFlushService);
    for (const [id, name] of [
      [DEFAULT_WORKSPACE_ID, 'Default'],
      [OTHER_WORKSPACE, 'Other'],
    ]) {
      await prisma.workspace.upsert({
        where: { id },
        update: {},
        create: { id, name },
      });
    }
  });

  beforeEach(async () => {
    await obliterateQueues(app);
    await pauseQueues(app);
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Webhook", "AlertEvent", "ChartCapture" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.workspace.deleteMany({ where: { id: OTHER_WORKSPACE } });
    await obliterateQueues(app);
    await app.close();
  });

  it('collects an entry and the milestone it crossed', async () => {
    const you = await seedApp('you');
    await rankedYesterday(you.id, null);
    chartOf({ 'you-store': 7 });

    await check();

    const rows = await outbox();
    expect([...rows.keys()].sort()).toEqual([
      'chart.entered',
      'chart.milestone',
    ]);
    expect(rows.get('chart.entered')).toMatchObject({
      appId: you.id,
      dedupeKey: `chart:${you.id}:free:6007:${today()}`,
      payload: {
        app: {
          id: you.id,
          name: 'you',
          iconUrl: 'https://is1-ssl.mzstatic.com/image/thumb/you.jpg',
          store: 'APP_STORE',
          country: 'us',
        },
        chart: {
          store: 'APP_STORE',
          country: 'us',
          collection: 'free',
          genre: '6007',
          genreName: 'Productivity',
          device: 'iphone',
        },
        date: today(),
        from: null,
        to: 7,
        depth: 100,
      },
    });
    expect(rows.get('chart.milestone')).toMatchObject({
      dedupeKey: `chart-milestone:${you.id}:free:6007:${today()}`,
      payload: { tier: 10, direction: 'entered', from: null, to: 7 },
    });
  });

  it('collects only a milestone for a climb inside the chart', async () => {
    const you = await seedApp('you');
    await rankedYesterday(you.id, 14);
    chartOf({ 'you-store': 8 });

    await check();

    const rows = await outbox();
    expect([...rows.keys()]).toEqual(['chart.milestone']);
    expect(rows.get('chart.milestone')?.payload).toMatchObject({
      tier: 10,
      direction: 'entered',
      from: 14,
      to: 8,
    });
  });

  it('collects an exit and the milestone it lost', async () => {
    const you = await seedApp('you');
    await rankedYesterday(you.id, 7);
    chartOf({});

    await check();

    const rows = await outbox();
    expect([...rows.keys()].sort()).toEqual(['chart.left', 'chart.milestone']);
    expect(rows.get('chart.left')?.payload).toMatchObject({
      from: 7,
      to: null,
    });
    expect(rows.get('chart.milestone')?.payload).toMatchObject({
      tier: 10,
      direction: 'left',
    });
  });

  it('collects nothing on the first ever check and still records it', async () => {
    const you = await seedApp('you');
    chartOf({ 'you-store': 7 });

    await check();

    expect((await outbox()).size).toBe(0);
    expect((await todayRank(you.id))?.position).toBe(7);
  });

  it('collects nothing for a move that crosses no line', async () => {
    const you = await seedApp('you');
    await rankedYesterday(you.id, 40);
    chartOf({ 'you-store': 38 });

    await check();

    expect((await outbox()).size).toBe(0);
  });

  it('collects nothing for a competitor', async () => {
    const you = await seedApp('you');
    const rival = await seedApp('rival', {
      isCompetitor: true,
      primaryAppId: you.id,
    });
    await rankedYesterday(rival.id, null);
    chartOf({ 'rival-store': 7 });

    await check();

    expect((await outbox()).size).toBe(0);
    expect((await todayRank(rival.id))?.position).toBe(7);
  });

  it('collects nothing from a chart the store listed no apps in', async () => {
    const you = await seedApp('you');
    await rankedYesterday(you.id, 7);
    topCharts.mockReset().mockResolvedValue([]);

    await check();

    expect(await prisma.chartCapture.count()).toBe(1);
    expect((await todayRank(you.id))?.position).toBeNull();
    expect((await outbox()).size).toBe(0);
  });

  it('compares with the check before a day the store listed no apps', async () => {
    const you = await seedApp('you');
    await prisma.categoryRank.create({
      data: {
        appId: you.id,
        date: addDays(utcToday(), -2),
        collection: 'free',
        genre: '6007',
        position: 7,
        depth: 100,
      },
    });
    await rankedYesterday(you.id, null);
    await prisma.chartCapture.create({
      data: {
        store: Store.APP_STORE,
        country: 'us',
        collection: 'free',
        genre: '6007',
        device: 'iphone',
        date: addDays(utcToday(), -1),
        depth: 100,
      },
    });
    chartOf({ 'you-store': 7 });

    await check();

    expect((await outbox()).size).toBe(0);
    expect((await todayRank(you.id))?.position).toBe(7);
  });

  it('collects nothing more when the same check runs again', async () => {
    const you = await seedApp('you');
    await rankedYesterday(you.id, null);
    chartOf({ 'you-store': 7 });

    await check();
    const first = await outbox();
    await check();
    const second = await outbox();

    expect(await prisma.alertEvent.count()).toBe(2);
    for (const [event, row] of first) {
      expect(second.get(event)?.createdAt).toEqual(row.createdAt);
    }
  });

  it('updates the move in place when the position changes the same day', async () => {
    const you = await seedApp('you');
    await rankedYesterday(you.id, null);
    chartOf({ 'you-store': 7 });
    await check();
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "ChartCapture" CASCADE');
    chartOf({ 'you-store': 9 });

    await check();

    const entered = await prisma.alertEvent.findMany({
      where: { event: 'chart.entered' },
    });
    expect(entered).toHaveLength(1);
    expect((entered[0].payload as unknown as ChartEnteredPayload).to).toBe(9);
  });

  it('delivers each chart event only to the channels that list it', async () => {
    const you = await seedApp('you');
    await rankedYesterday(you.id, null);
    const subscribe = (events: string[]) =>
      prisma.webhook.create({
        data: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          url: `https://hooks.example.com/${events.join('-') || 'none'}`,
          events,
        },
      });
    const entries = await subscribe(['chart.entered']);
    const milestones = await subscribe(['chart.milestone']);
    await subscribe(['rank.dropped']);
    chartOf({ 'you-store': 7 });

    await check();
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
    const batchOf = (webhookId: string): AlertBatchPayload => {
      const job = jobs.find(
        (candidate) => candidate.data.webhookId === webhookId,
      );
      if (!job) throw new Error(`no delivery job for webhook ${webhookId}`);
      return job.data.payload as AlertBatchPayload;
    };
    expect(jobs).toHaveLength(2);
    expect(batchOf(entries.id).apps[0].chartMoves).toEqual([
      expect.objectContaining({ event: 'chart.entered' }),
    ]);
    expect(batchOf(entries.id).events).toHaveLength(1);
    expect(batchOf(milestones.id).events).toHaveLength(1);
    expect(batchOf(milestones.id).apps[0].chartMoves).toEqual([
      expect.objectContaining<Partial<ChartMilestonePayload>>({
        event: 'chart.milestone',
        tier: 10,
      }),
    ]);
  });

  it('keeps the alerts of each workspace to that workspace', async () => {
    const first = await seedApp('first');
    const second = await seedApp('second', { workspaceId: OTHER_WORKSPACE });
    await rankedYesterday(first.id, null);
    await rankedYesterday(second.id, null);
    chartOf({ 'first-store': 3, 'second-store': 5 });

    await check(DEFAULT_WORKSPACE_ID);
    await check(OTHER_WORKSPACE);

    const rows = await prisma.alertEvent.findMany({
      where: { event: 'chart.entered' },
      select: { appId: true, workspaceId: true },
    });
    expect(rows).toHaveLength(2);
    expect(rows).toEqual(
      expect.arrayContaining([
        { appId: first.id, workspaceId: DEFAULT_WORKSPACE_ID },
        { appId: second.id, workspaceId: OTHER_WORKSPACE },
      ]),
    );
    const scoped = app.get(PrismaService);
    const visible = (workspaceId: string) =>
      asWorkspace(
        app,
        () =>
          scoped.alertEvent.findMany({
            where: { event: 'chart.entered' },
            select: { appId: true },
          }),
        workspaceId,
      );
    expect(await visible(DEFAULT_WORKSPACE_ID)).toEqual([{ appId: first.id }]);
    expect(await visible(OTHER_WORKSPACE)).toEqual([{ appId: second.id }]);
  });
});
