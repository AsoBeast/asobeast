import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import { AlertBatchPayload } from '@asobeast/shared';
import { Queue } from 'bullmq';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AlertFlushService } from '../src/alerts/alert-flush.service';
import { MailerService } from '../src/alerts/mailer.service';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import {
  DeliverAlertPayload,
  DeliverEmailPayload,
  QUEUES,
} from '../src/jobs/jobs.types';
import { RankingsService } from '../src/rankings/rankings.service';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { SearchItem, StoreProvider } from '../src/store-providers/types';
import { asWorkspace } from './helpers/tenancy';
import { testDb } from './helpers/test-db';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

const RANK_EVENTS = ['rank.dropped', 'rank.improved', 'rank.milestone'];

function utcMidnight(offsetDays: number): Date {
  const now = new Date();
  const date = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  date.setUTCDate(date.getUTCDate() - offsetDays);
  return date;
}

describe('confirmed rank drops (e2e)', () => {
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

  const seed = async (): Promise<{ you: string; keywordId: string }> => {
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
    return { you: you.id, keywordId: keyword.id };
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

  const checkAt = async (keywordId: string, position: number) => {
    results = serpAt({ 'self-store': position });
    await asWorkspace(app, () => rankings.checkKeyword(keywordId));
  };

  const outbox = () =>
    prisma.alertEvent.findMany({
      select: { event: true, appId: true, dedupeKey: true, payload: true },
      orderBy: { dedupeKey: 'asc' },
    });

  const webhook = (path: string, confirmDrops: boolean) =>
    prisma.webhook.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        url: `https://hooks.example.com/${path}`,
        events: RANK_EVENTS,
        confirmDrops,
      },
    });

  const emailAlert = (email: string, confirmDrops: boolean) =>
    prisma.emailAlert.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        email,
        events: RANK_EVENTS,
        confirmedAt: new Date(),
        confirmDrops,
      },
    });

  const deliveries = async () => {
    const queue = app.get<Queue<DeliverAlertPayload | DeliverEmailPayload>>(
      getQueueToken(QUEUES.ALERTS),
      { strict: false },
    );
    const jobs = await queue.getJobs([
      'wait',
      'paused',
      'delayed',
      'waiting-children',
    ]);
    return new Map(
      jobs.map((job) => [
        'webhookId' in job.data ? job.data.webhookId : job.data.emailAlertId,
        job.data.payload as AlertBatchPayload,
      ]),
    );
  };

  const today = (): string => utcMidnight(0).toISOString().slice(0, 10);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StoreProviderRegistry)
      .useValue(registry)
      .overrideProvider(MailerService)
      .useValue({ enabled: true, send: jest.fn() })
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
      'TRUNCATE TABLE "App", "Keyword", "Webhook", "EmailAlert", "AlertEvent" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await obliterateQueues(app);
    await app.close();
  });

  it('stores a confirmed leave under its own key', async () => {
    const { you, keywordId } = await seed();
    await rankedOn(you, keywordId, 2, 9);
    await rankedOn(you, keywordId, 1, 11);

    await checkAt(keywordId, 12);

    expect(await outbox()).toEqual([
      {
        event: 'rank.milestone',
        appId: you,
        dedupeKey: `milestone.confirmed:${you}:${keywordId}:${today()}`,
        payload: expect.objectContaining({
          tier: 10,
          direction: 'left',
          from: 9,
          to: 12,
          confirmed: true,
        }) as unknown,
      },
    ]);
  });

  it('marks a recovery instead of confirming it', async () => {
    const { you, keywordId } = await seed();
    await rankedOn(you, keywordId, 2, 9);
    await rankedOn(you, keywordId, 1, 11);

    await checkAt(keywordId, 9);

    const rows = await outbox();
    expect(rows).toEqual([
      expect.objectContaining({
        dedupeKey: `milestone:${you}:${keywordId}:${today()}`,
        payload: expect.objectContaining({
          direction: 'entered',
          undoesDrop: true,
        }) as unknown,
      }),
    ]);
    expect(rows[0].payload).not.toHaveProperty('confirmed');
  });

  it('stores the ordinary and the confirmed row of a deepening drop apart', async () => {
    const { you, keywordId } = await seed();
    await rankedOn(you, keywordId, 2, 9);
    await rankedOn(you, keywordId, 1, 11);

    await checkAt(keywordId, 20);

    const rows = await outbox();
    expect(rows.map((row) => row.dedupeKey)).toEqual([
      `milestone.confirmed:${you}:${keywordId}:${today()}`,
      `rank:${you}:${keywordId}:${today()}`,
    ]);
    expect(rows[1].payload).toMatchObject({
      event: 'rank.dropped',
      from: 11,
      to: 20,
    });
    expect(rows[1].payload).not.toHaveProperty('confirmed');
  });

  it('confirms across a gap of days between checks', async () => {
    const { you, keywordId } = await seed();
    await rankedOn(you, keywordId, 6, 9);
    await rankedOn(you, keywordId, 1, 11);

    await checkAt(keywordId, 12);

    expect((await outbox()).map((row) => row.dedupeKey)).toEqual([
      `milestone.confirmed:${you}:${keywordId}:${today()}`,
    ]);
  });

  it('confirms nothing on the first and the second check of a keyword', async () => {
    const { you, keywordId } = await seed();

    await checkAt(keywordId, 12);
    expect(await outbox()).toEqual([]);

    await prisma.keywordRanking.deleteMany({ where: { keywordId } });
    await rankedOn(you, keywordId, 1, 11);
    await checkAt(keywordId, 12);
    expect(await outbox()).toEqual([]);
  });

  it('confirms on the first check after a paused keyword resumes', async () => {
    const { you, keywordId } = await seed();
    await rankedOn(you, keywordId, 40, 9);
    await rankedOn(you, keywordId, 39, 11);

    await checkAt(keywordId, 12);

    expect((await outbox()).map((row) => row.dedupeKey)).toEqual([
      `milestone.confirmed:${you}:${keywordId}:${today()}`,
    ]);
  });

  it('splits a deepening drop between a plain and a confirming webhook', async () => {
    const { you, keywordId } = await seed();
    await rankedOn(you, keywordId, 2, 9);
    await rankedOn(you, keywordId, 1, 11);
    const plain = await webhook('plain', false);
    const confirming = await webhook('confirming', true);

    await checkAt(keywordId, 20);
    await asWorkspace(app, () => flush.flush());

    const batches = await deliveries();
    expect(batches.get(plain.id)?.events).toEqual([
      expect.objectContaining({ event: 'rank.dropped', from: 11, to: 20 }),
    ]);
    expect(batches.get(confirming.id)?.events).toEqual([
      expect.objectContaining({
        event: 'rank.milestone',
        direction: 'left',
        from: 9,
        to: 20,
        confirmed: true,
      }),
    ]);
  });

  it('sends a recovery only to the plain webhook', async () => {
    const { you, keywordId } = await seed();
    await rankedOn(you, keywordId, 2, 9);
    await rankedOn(you, keywordId, 1, 11);
    const plain = await webhook('plain', false);
    const confirming = await webhook('confirming', true);

    await checkAt(keywordId, 9);
    await asWorkspace(app, () => flush.flush());

    const batches = await deliveries();
    expect(batches.get(plain.id)?.events).toEqual([
      expect.objectContaining({
        event: 'rank.milestone',
        direction: 'entered',
        undoesDrop: true,
      }),
    ]);
    expect(batches.has(confirming.id)).toBe(false);
  });

  it('splits email alerts the same way', async () => {
    const { you, keywordId } = await seed();
    await rankedOn(you, keywordId, 2, 9);
    await rankedOn(you, keywordId, 1, 11);
    const plain = await emailAlert('plain@example.com', false);
    const confirming = await emailAlert('confirming@example.com', true);

    await checkAt(keywordId, 20);
    await asWorkspace(app, () => flush.flush());

    const batches = await deliveries();
    expect(batches.get(plain.id)?.events.map((event) => event.event)).toEqual([
      'rank.dropped',
    ]);
    expect(batches.get(confirming.id)?.events).toEqual([
      expect.objectContaining({ event: 'rank.milestone', confirmed: true }),
    ]);
  });
});
