import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, PrismaClient, Store } from '@prisma/client';
import type {
  AlertEventItem,
  AlertEventList,
  GranularAlertPayload,
  SerpEntrantPayload,
} from '@asobeast/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { decodeCursor } from '../src/alerts/alert-event-cursor';
import { chartEntered } from '../src/alerts/chart-events.fixture';
import {
  actionOpened,
  metadata,
  negative,
  newReview,
} from '../src/alerts/email-fixtures.fixture';
import { outboxRows } from '../src/alerts/outbox-rows';
import { drop, milestone } from '../src/alerts/rank-events.fixture';
import { sentenceOf } from '../src/alerts/report/report-sentences';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { seedApiToken } from './helpers/api-tokens';
import { ownerAgent, useCookies } from './helpers/session';
import { testDb } from './helpers/test-db';
import { obliterateQueues, settleBootRegistration } from './obliterate-queues';

const OTHER_WORKSPACE = 'ws_alert_feed_other';
const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

interface Apps {
  primary: string;
  second: string;
  rival: string;
  keyword: string;
}

interface SeedOptions {
  ago?: number;
  at?: Date;
  flushed?: boolean;
  dedupeKey?: string;
  workspaceId?: string;
}

describe('GET /alerts/events (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;
  let apps: Apps;

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
    await settleBootRegistration(app);

    prisma = testDb();
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
    api = await ownerAgent(app);
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword", "AlertEvent", "Webhook", "EmailAlert" RESTART IDENTITY CASCADE',
    );
    apps = await seedApps();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const createApp = async (
    storeAppId: string,
    name: string,
    primaryAppId: string | null = null,
    workspaceId = DEFAULT_WORKSPACE_ID,
  ): Promise<string> => {
    const created = await prisma.app.create({
      data: {
        workspaceId,
        store: Store.APP_STORE,
        storeAppId,
        country: 'us',
        name,
        isCompetitor: primaryAppId !== null,
        primaryAppId,
      },
    });
    return created.id;
  };

  const track = (appId: string, keywordId: string, active = true) =>
    prisma.trackedKeyword.create({
      data: { appId, keywordId, source: 'MANUAL', active },
    });

  const seedApps = async (): Promise<Apps> => {
    const primary = await createApp('feed-primary', 'Primary');
    const second = await createApp('feed-second', 'Second');
    const rival = await createApp('feed-rival', 'Rival', primary);
    const keyword = await prisma.keyword.create({
      data: { text: 'habit tracker', store: Store.APP_STORE, country: 'de' },
    });
    await track(primary, keyword.id);
    await track(second, keyword.id);
    return { primary, second, rival, keyword: keyword.id };
  };

  const onApp = <T extends GranularAlertPayload>(payload: T, id: string): T =>
    'app' in payload ? { ...payload, app: { ...payload.app, id } } : payload;

  const seed = async (
    payload: GranularAlertPayload,
    options: SeedOptions = {},
  ): Promise<string> => {
    const [row] = outboxRows(payload);
    const createdAt =
      options.at ?? new Date(Date.now() - (options.ago ?? 1) * MINUTE_MS);
    const created = await prisma.alertEvent.create({
      data: {
        workspaceId: options.workspaceId ?? DEFAULT_WORKSPACE_ID,
        event: row.event,
        appId: row.appId,
        keywordId: row.keywordId,
        dedupeKey:
          options.dedupeKey ?? `${row.dedupeKey}:${createdAt.getTime()}`,
        payload: row.payload as unknown as Prisma.InputJsonValue,
        createdAt,
        flushedAt: options.flushed ? createdAt : null,
      },
    });
    return created.id;
  };

  const entrant = (): SerpEntrantPayload => ({
    event: 'serp.entrant',
    occurredAt: new Date().toISOString(),
    keyword: {
      id: apps.keyword,
      text: 'habit tracker',
      store: 'APP_STORE',
      country: 'de',
    },
    date: '2026-11-03',
    entrants: [],
  });

  const list = async (query = ''): Promise<AlertEventList> => {
    const response = await api.get(`/alerts/events${query}`).expect(200);
    return response.body as AlertEventList;
  };

  const ids = (body: AlertEventList) => body.events.map((event) => event.id);

  it('lists every recorded event without any subscription, newest first', async () => {
    const rank = await seed(onApp(drop(), apps.primary), { ago: 50 });
    const chart = await seed(onApp(chartEntered(), apps.primary), {
      ago: 40,
      flushed: true,
    });
    const change = await seed(onApp(metadata, apps.rival), { ago: 30 });
    const review = await seed(onApp(negative, apps.primary), { ago: 20 });
    const action = await seed(onApp(actionOpened, apps.primary), {
      ago: 10,
      flushed: true,
    });

    const body = await list();

    expect(await prisma.webhook.count()).toBe(0);
    expect(await prisma.emailAlert.count()).toBe(0);
    expect(ids(body)).toEqual([action, review, change, chart, rank]);
    expect(body.nextCursor).toBeNull();
    const byId = new Map(body.events.map((event) => [event.id, event]));
    const changeItem = byId.get(change) as AlertEventItem;
    expect(changeItem).toMatchObject({
      event: 'metadata.changed',
      appId: apps.rival,
      primaryAppId: apps.primary,
    });
    expect(changeItem.sentence).toBe(
      sentenceOf(changeItem.payload, false).text,
    );
    expect(byId.get(rank)).toMatchObject({
      event: 'rank.dropped',
      country: 'us',
      primaryAppId: apps.primary,
      payload: onApp(drop(), apps.primary),
    });
    expect(byId.get(chart)?.country).toBe('us');
    expect(byId.get(action)?.country).toBe('us');
  });

  it('pages by cursor without losing or repeating a row', async () => {
    const tie = new Date(Date.now() - 30 * MINUTE_MS);
    const seeded = [
      await seed(onApp(drop(), apps.primary), { ago: 10 }),
      await seed(onApp(milestone(), apps.primary), { ago: 20 }),
      await seed(onApp(chartEntered(), apps.primary), { at: tie }),
      await seed(onApp(negative, apps.primary), { at: tie }),
      await seed(onApp(metadata, apps.primary), { ago: 40 }),
    ];

    const first = await list('?limit=2');
    expect(first.events).toHaveLength(2);
    expect(first.nextCursor).toEqual(expect.any(String));

    await seed(onApp(actionOpened, apps.primary), { ago: 15 });

    const second = await list(`?limit=2&cursor=${first.nextCursor}`);
    const third = await list(`?limit=2&cursor=${second.nextCursor}`);

    expect(third.nextCursor).toBeNull();
    const paged = [...ids(first), ...ids(second), ...ids(third)];
    expect(new Set(paged).size).toBe(paged.length);
    const tied = seeded.slice(2, 4).sort().reverse();
    expect(paged).toEqual([seeded[0], seeded[1], ...tied, seeded[4]]);
  });

  it('filters by type, comma separated or repeated', async () => {
    const rank = await seed(onApp(drop(), apps.primary), { ago: 20 });
    const chart = await seed(onApp(chartEntered(), apps.primary), { ago: 10 });
    await seed(onApp(negative, apps.primary), { ago: 5 });

    expect(ids(await list('?type=rank.dropped,chart.entered'))).toEqual([
      chart,
      rank,
    ]);
    expect(ids(await list('?type=rank.dropped&type=chart.entered'))).toEqual([
      chart,
      rank,
    ]);
    expect(ids(await list('?type=rank.dropped'))).toEqual([rank]);
  });

  it.each([
    'type=review.new',
    'type=digest.weekly',
    'type=nope',
    'since=garbage',
    'since=20261101',
    'since=2026-11-01T00:00:00',
    'cursor=garbage',
    'limit=0',
    'limit=101',
  ])('refuses %s with 400', async (query) => {
    await api.get(`/alerts/events?${query}`).expect(400);
  });

  it('hides new reviews, confirmed copies and removed apps', async () => {
    const listed = await seed(onApp(drop(), apps.primary), { ago: 5 });
    await seed(onApp(newReview, apps.primary), { ago: 6 });
    await seed(onApp(drop({ confirmed: true }), apps.primary), {
      ago: 7,
      dedupeKey: `rank.confirmed:${apps.primary}:k:2026-11-03`,
    });
    await seed(onApp(milestone({ confirmed: true }), apps.primary), {
      ago: 8,
      dedupeKey: `milestone.confirmed:${apps.primary}:k:2026-11-03`,
    });
    const gone = await createApp('feed-gone', 'Gone', apps.primary);
    await seed(onApp(metadata, gone), { ago: 9 });
    await prisma.app.delete({ where: { id: gone } });

    expect(ids(await list())).toEqual([listed]);
  });

  it('scopes to an app, its competitors and the entrants of its keywords', async () => {
    const own = await seed(onApp(drop(), apps.primary), { ago: 10 });
    const rivalChange = await seed(onApp(metadata, apps.rival), { ago: 20 });
    const entrantRow = await seed(entrant(), { ago: 30 });
    const other = await seed(onApp(drop(), apps.second), { ago: 40 });

    expect(ids(await list(`?appId=${apps.primary}`))).toEqual([
      own,
      rivalChange,
      entrantRow,
    ]);
    expect(ids(await list(`?appId=${apps.rival}`))).toEqual([rivalChange]);
    expect(ids(await list(`?appId=${apps.second}`))).toEqual([
      entrantRow,
      other,
    ]);
  });

  it('leaves out the entrants of a keyword the app no longer tracks', async () => {
    await prisma.trackedKeyword.updateMany({
      where: { appId: apps.second },
      data: { active: false },
    });
    await seed(entrant(), { ago: 30 });

    expect((await list(`?appId=${apps.second}`)).events).toEqual([]);
  });

  it('answers 404 for an unknown app and for another workspace', async () => {
    const foreign = await createApp(
      'feed-foreign',
      'Foreign',
      null,
      OTHER_WORKSPACE,
    );
    await seed(onApp(drop(), foreign), { workspaceId: OTHER_WORKSPACE });

    await api.get('/alerts/events?appId=nope').expect(404);
    await api.get(`/alerts/events?appId=${foreign}`).expect(404);
    expect((await list()).events).toEqual([]);
  });

  it('attributes an entrant to the first tracker or to the filtered app', async () => {
    await seed(entrant(), { ago: 5 });
    const [first, second] = [apps.primary, apps.second].sort();

    expect((await list()).events[0].primaryAppId).toBe(first);
    expect((await list(`?appId=${second}`)).events[0].primaryAppId).toBe(
      second,
    );
  });

  it('lists only rows after since and never beyond the window', async () => {
    const recent = await seed(onApp(drop(), apps.primary), { ago: 10 });
    const older = new Date(Date.now() - 60 * MINUTE_MS);
    await seed(onApp(chartEntered(), apps.primary), { at: older });
    await seed(onApp(negative, apps.primary), {
      at: new Date(Date.now() - 40 * DAY_MS),
    });
    const kept = await seed(onApp(metadata, apps.primary), {
      at: new Date(Date.now() - 29 * DAY_MS),
    });

    expect(ids(await list(`?since=${older.toISOString()}`))).toEqual([recent]);
    expect(ids(await list('?since=2020-01-01'))).toEqual([
      recent,
      expect.any(String),
      kept,
    ]);
  });

  it('fills a page past the rows of a removed app', async () => {
    const gone = await createApp('feed-removed', 'Removed', apps.primary);
    for (const ago of [1, 2, 3]) {
      await seed(onApp(metadata, gone), { ago });
    }
    const older = await seed(onApp(drop(), apps.primary), { ago: 10 });
    const oldest = await seed(onApp(negative, apps.primary), { ago: 20 });
    await prisma.app.delete({ where: { id: gone } });

    const first = await list('?limit=1');
    const second = await list(`?limit=1&cursor=${first.nextCursor}`);

    expect(ids(first)).toEqual([older]);
    expect(ids(second)).toEqual([oldest]);
    expect(second.nextCursor).toBeNull();
  });

  it('reads past every skipped row ahead of the newest event', async () => {
    const gone = await createApp('feed-many-removed', 'Removed', apps.primary);
    for (const ago of [1, 2, 3, 4, 5, 6]) {
      await seed(onApp(metadata, gone), { ago });
    }
    const newest = await seed(onApp(drop(), apps.primary), { ago: 10 });
    await prisma.app.delete({ where: { id: gone } });

    const body = await list('?limit=1');

    expect(ids(body)).toEqual([newest]);
    expect(body.nextCursor).toBeNull();
  });

  it('reads an empty type as every feed event', async () => {
    const row = await seed(onApp(drop(), apps.primary));

    expect(ids(await list('?type='))).toEqual([row]);
  });

  it('skips an unreadable row and still answers the page', async () => {
    const readable = await seed(onApp(drop(), apps.primary), { ago: 5 });
    const broken = await seed(onApp(negative, apps.primary), { ago: 6 });
    await prisma.alertEvent.update({
      where: { id: broken },
      data: { payload: {} },
    });

    expect(ids(await list())).toEqual([readable]);
  });

  const unreadable = async (ago: number): Promise<string> => {
    const id = await seed(onApp(negative, apps.primary), { ago });
    await prisma.alertEvent.update({ where: { id }, data: { payload: {} } });
    return id;
  };

  it('ends the feed when only skipped rows follow the last event', async () => {
    const gone = await createApp('feed-tail-removed', 'Removed', apps.primary);
    const newest = await seed(onApp(drop(), apps.primary), { ago: 1 });
    await unreadable(2);
    await seed(onApp(metadata, gone), { ago: 3 });
    await unreadable(4);
    await prisma.app.delete({ where: { id: gone } });

    const body = await list('?limit=1');

    expect(ids(body)).toEqual([newest]);
    expect(body.nextCursor).toBeNull();
  });

  it('answers a cursor when an event follows the skipped rows', async () => {
    const newest = await seed(onApp(drop(), apps.primary), { ago: 1 });
    await unreadable(2);
    await unreadable(3);
    const older = await seed(onApp(metadata, apps.primary), { ago: 4 });

    const first = await list('?limit=1');
    const second = await list(`?limit=1&cursor=${first.nextCursor}`);

    expect(ids(first)).toEqual([newest]);
    expect(first.nextCursor).toEqual(expect.any(String));
    expect(decodeCursor(first.nextCursor ?? '')?.id).toBe(newest);
    expect(ids(second)).toEqual([older]);
    expect(second.nextCursor).toBeNull();
  });

  it('answers a cursor when the next event lies a whole batch of skipped rows away', async () => {
    const newest = await seed(onApp(drop(), apps.primary), { ago: 1 });
    for (let ago = 2; ago <= 121; ago += 1) {
      await unreadable(ago);
    }
    const older = await seed(onApp(metadata, apps.primary), { ago: 130 });

    const first = await list('?limit=1');
    const second = await list(`?limit=1&cursor=${first.nextCursor}`);

    expect(ids(first)).toEqual([newest]);
    expect(decodeCursor(first.nextCursor ?? '')?.id).toBe(newest);
    expect(ids(second)).toEqual([older]);
    expect(second.nextCursor).toBeNull();
  });

  it('stores the keyword column and the time index', async () => {
    const columns = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'AlertEvent' AND column_name = 'keywordId'`;
    const indexes = await prisma.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes
      WHERE tablename = 'AlertEvent'
        AND indexname = 'AlertEvent_workspaceId_createdAt_id_idx'`;

    expect(columns).toHaveLength(1);
    expect(indexes[0].indexdef).toContain(
      '("workspaceId", "createdAt" DESC, id DESC)',
    );
  });

  it('answers a read scoped token', async () => {
    const row = await seed(onApp(drop(), apps.primary));
    const token = await seedApiToken(prisma, {
      seed: 'alertfeedreader',
      email: 'alert-feed-reader@example.com',
      workspaceId: DEFAULT_WORKSPACE_ID,
      role: 'member',
      scope: 'read',
    });

    const response = await request(app.getHttpServer())
      .get('/alerts/events')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(ids(response.body as AlertEventList)).toEqual([row]);
  });
});
