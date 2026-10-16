import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import { ChartGenre, ChartPage } from '@asobeast/shared';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import {
  addDays,
  toDateKey,
  utcToday,
} from '../src/analytics/analytics.support';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { StoreRequestError } from '../src/store-providers/errors';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { StoreProvider } from '../src/store-providers/types';
import { testDb } from './helpers/test-db';
import { ownerAgent, useCookies } from './helpers/session';
import { obliterateQueues, settleBootRegistration } from './obliterate-queues';

const OTHER_WORKSPACE = 'ws_charts_other';
const KEY = {
  store: 'APP_STORE',
  country: 'us',
  collection: 'free',
  genre: '6014',
  device: 'iphone',
} as const;

describe('ChartsController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;
  const topCharts = jest.fn();
  const registry = {
    get: () => ({ topCharts }) as unknown as StoreProvider,
  };
  const today = utcToday();
  const weekAgo = addDays(today, -7);

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
    await settleBootRegistration(app);

    prisma = testDb();
    for (const id of [DEFAULT_WORKSPACE_ID, OTHER_WORKSPACE]) {
      await prisma.workspace.upsert({
        where: { id },
        update: {},
        create: { id, name: id },
      });
    }
    api = await ownerAgent(app);
  });

  beforeEach(async () => {
    topCharts.mockReset();
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword", "ChartCapture", "ChartFollow" RESTART IDENTITY CASCADE',
    );
    const capture = (date: Date, order: string[]) =>
      prisma.chartCapture.create({
        data: {
          ...KEY,
          date,
          depth: 100,
          entries: {
            create: order.map((storeAppId, index) => ({
              position: index + 1,
              storeAppId,
              title: storeAppId.toUpperCase(),
              developer: storeAppId === 'a' ? 'Acme' : null,
              genreId: '6014',
              free: true,
            })),
          },
        },
      });
    await capture(today, ['a', 'b', 'c', 'd']);
    await capture(weekAgo, ['b', 'a', 'c', 'e']);
  });

  afterAll(async () => {
    await prisma.workspace.deleteMany({ where: { id: OTHER_WORKSPACE } });
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const read = (query: Record<string, string> = {}) =>
    api.get('/charts').query({ ...KEY, ...query });

  it('answers the newest capture with movement against the previous day by default', async () => {
    const response = await read().expect(200);
    const page = response.body as ChartPage;

    expect(page.chart).toEqual({ ...KEY, genreName: 'Games' });
    expect(page.capture).toMatchObject({ date: toDateKey(today), depth: 100 });
    expect(page.comparison).toBeNull();
    expect(page.compare).toBe('1d');
    expect(page.entries.map((entry) => entry.movement)).toEqual([
      'none',
      'none',
      'none',
      'none',
    ]);
    expect(page.entries[0]).toEqual({
      position: 1,
      storeAppId: 'a',
      title: 'A',
      developer: 'Acme',
      iconUrl: null,
      genreId: '6014',
      genreName: 'Games',
      free: true,
      previous: null,
      delta: null,
      movement: 'none',
    });
    expect(page.trending).toEqual({
      climbers: [],
      fallers: [],
      entries: [],
      exits: [],
    });
    expect(page.dates).toEqual([toDateKey(today), toDateKey(weekAgo)]);
    expect(page.today).toBe(toDateKey(today));
    expect(page.followed).toBeNull();
    expect(page.apps).toEqual([]);
  });

  it('compares against the newest capture at or before the window', async () => {
    const response = await read({ compare: '7d' }).expect(200);
    const page = response.body as ChartPage;

    expect(page.comparison?.date).toBe(toDateKey(weekAgo));
    expect(
      page.entries.map(({ storeAppId, previous, delta, movement }) => [
        storeAppId,
        previous,
        delta,
        movement,
      ]),
    ).toEqual([
      ['a', 2, -1, 'up'],
      ['b', 1, 1, 'down'],
      ['c', 3, 0, 'same'],
      ['d', null, null, 'new'],
    ]);
    expect(page.trending.climbers.map((row) => row.storeAppId)).toEqual(['a']);
    expect(page.trending.fallers.map((row) => row.storeAppId)).toEqual(['b']);
    expect(page.trending.entries.map((row) => row.storeAppId)).toEqual(['d']);
    expect(page.trending.exits).toEqual([
      {
        storeAppId: 'e',
        title: 'E',
        developer: null,
        iconUrl: null,
        position: null,
        previous: 4,
        delta: null,
      },
    ]);
  });

  it('reads a chosen day', async () => {
    const response = await read({ date: toDateKey(weekAgo) }).expect(200);
    const page = response.body as ChartPage;

    expect(page.capture?.date).toBe(toDateKey(weekAgo));
    expect(page.comparison).toBeNull();
    expect(page.entries.map((entry) => entry.storeAppId)).toEqual([
      'b',
      'a',
      'c',
      'e',
    ]);
  });

  it('answers a day with no capture as empty', async () => {
    const response = await read({
      date: toDateKey(addDays(today, -1)),
    }).expect(200);
    const page = response.body as ChartPage;

    expect(page.capture).toBeNull();
    expect(page.comparison).toBeNull();
    expect(page.entries).toEqual([]);
    expect(page.dates).toHaveLength(2);
  });

  it("links the workspace's apps", async () => {
    const own = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: 'a',
        country: 'us',
        name: 'Mine',
      },
    });
    const rival = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: 'b',
        country: 'us',
        name: 'Rival',
        isCompetitor: true,
        primaryAppId: own.id,
      },
    });
    await prisma.app.create({
      data: {
        workspaceId: OTHER_WORKSPACE,
        store: Store.APP_STORE,
        storeAppId: 'c',
        country: 'us',
        name: 'Theirs',
      },
    });

    const response = await read().expect(200);

    expect((response.body as ChartPage).apps).toEqual([
      {
        storeAppId: 'a',
        appId: own.id,
        primaryAppId: null,
        name: 'Mine',
        role: 'own',
      },
      {
        storeAppId: 'b',
        appId: rival.id,
        primaryAppId: own.id,
        name: 'Mine',
        role: 'competitor',
      },
    ]);
  });

  it.each([
    ['an unknown store', { store: 'OTHER' }],
    ['a country that is not a code', { country: 'usa' }],
    ['a country the store lacks', { country: 'zz' }],
    ['a genre the store does not chart', { genre: '9999' }],
    ['a play category on the app store', { genre: 'GAME' }],
    ['a device not captured', { device: 'ipad' }],
    ['an android chart on the app store', { device: 'android' }],
    ['an unknown compare window', { compare: '2d' }],
    ['a month that does not exist', { date: '2026-13-01' }],
    ['a day that does not exist', { date: '2026-02-30' }],
  ])('refuses %s and never reaches the store', async (_case, query) => {
    await read(query).expect(400);
    expect(topCharts).not.toHaveBeenCalled();
  });

  const CAPTURE_KEY = { ...KEY, genre: '6007' };

  it("captures today's chart on demand", async () => {
    topCharts.mockResolvedValue([
      {
        storeAppId: 'x',
        title: 'X',
        developer: 'Xco',
        iconUrl: 'https://example.com/x.png',
        genreId: '6007',
        free: true,
      },
      { storeAppId: 'y', title: 'Y', developer: 'Yco', free: false },
      { storeAppId: 'z', title: 'Z' },
    ]);

    const response = await api
      .post('/charts/capture')
      .send(CAPTURE_KEY)
      .expect(200);
    const page = response.body as ChartPage;

    expect(page.capture?.date).toBe(toDateKey(today));
    expect(page.entries).toEqual([
      expect.objectContaining({
        storeAppId: 'x',
        developer: 'Xco',
        iconUrl: 'https://example.com/x.png',
        genreName: 'Productivity',
        free: true,
        movement: 'none',
      }),
      expect.objectContaining({ storeAppId: 'y', free: false }),
      expect.objectContaining({ storeAppId: 'z', developer: null }),
    ]);
    const stored = await read({ genre: CAPTURE_KEY.genre }).expect(200);
    expect((stored.body as ChartPage).entries).toHaveLength(3);

    await api.post('/charts/capture').send(CAPTURE_KEY).expect(200);
    expect(topCharts).toHaveBeenCalledTimes(1);
  });

  it("keeps each storefront's own listing of an app", async () => {
    const row = (title: string) => [
      { storeAppId: 'shared', title, developer: `${title} Inc` },
    ];
    topCharts
      .mockResolvedValueOnce(row('Habit Tracker'))
      .mockResolvedValueOnce(row('習慣トラッカー'));

    await api.post('/charts/capture').send(CAPTURE_KEY).expect(200);
    await api
      .post('/charts/capture')
      .send({ ...CAPTURE_KEY, country: 'jp' })
      .expect(200);

    const us = await read({ genre: CAPTURE_KEY.genre }).expect(200);
    const jp = await read({ genre: CAPTURE_KEY.genre, country: 'jp' }).expect(
      200,
    );
    expect((us.body as ChartPage).entries[0]).toMatchObject({
      title: 'Habit Tracker',
      developer: 'Habit Tracker Inc',
    });
    expect((jp.body as ChartPage).entries[0].title).toBe('習慣トラッカー');
  });

  it("answers the store's failure as a bad gateway", async () => {
    topCharts.mockRejectedValue(
      new StoreRequestError('APP_STORE', 'topCharts', 'boom'),
    );

    await api.post('/charts/capture').send(CAPTURE_KEY).expect(502);

    await expect(
      prisma.chartCapture.count({ where: { genre: '6007' } }),
    ).resolves.toBe(0);
  });

  describe('a chart the store lists no apps in', () => {
    const PLAY_KEY = {
      store: 'GOOGLE_PLAY',
      country: 'pl',
      collection: 'paid',
      genre: 'SHOPPING',
      device: 'android',
    } as const;

    const playCapture = (date: Date, ids: string[]) =>
      prisma.chartCapture.create({
        data: {
          ...PLAY_KEY,
          date,
          depth: 200,
          entries: {
            create: ids.map((storeAppId, index) => ({
              position: index + 1,
              storeAppId,
              title: storeAppId,
            })),
          },
        },
      });

    const playCaptures = () =>
      prisma.chartCapture.count({ where: { genre: 'SHOPPING', date: today } });

    beforeEach(() => topCharts.mockResolvedValue([]));

    it('answers a first empty answer without storing it', async () => {
      const response = await api
        .post('/charts/capture')
        .send(PLAY_KEY)
        .expect(200);
      const page = response.body as ChartPage;

      expect(page.capture).toBeNull();
      expect(page.entries).toEqual([]);
      expect(page.answeredNoApps).toBe(true);
      expect(page.dates).not.toContain(toDateKey(today));
      await expect(playCaptures()).resolves.toBe(0);
    });

    it('stores an empty capture for a chart that was already empty', async () => {
      await playCapture(addDays(today, -1), []);

      const response = await api
        .post('/charts/capture')
        .send(PLAY_KEY)
        .expect(200);
      await api.post('/charts/capture').send(PLAY_KEY).expect(200);

      const page = response.body as ChartPage;
      expect(page.capture?.date).toBe(toDateKey(today));
      expect(page.entries).toEqual([]);
      expect(page.answeredNoApps).toBeUndefined();
      expect(topCharts).toHaveBeenCalledTimes(1);
      await expect(playCaptures()).resolves.toBe(1);
    });

    it('refuses an empty answer for a chart that listed apps yesterday', async () => {
      await playCapture(addDays(today, -1), ['a']);

      await api.post('/charts/capture').send(PLAY_KEY).expect(502);

      await expect(playCaptures()).resolves.toBe(0);
    });

    it('treats apps last listed eight days ago as no history', async () => {
      await playCapture(addDays(today, -8), ['a']);

      const response = await api
        .post('/charts/capture')
        .send(PLAY_KEY)
        .expect(200);

      expect((response.body as ChartPage).answeredNoApps).toBe(true);
      await expect(playCaptures()).resolves.toBe(0);
    });
  });

  it('refuses a bad key before the store', async () => {
    await api
      .post('/charts/capture')
      .send({ ...CAPTURE_KEY, genre: '9999' })
      .expect(400);
    await api
      .post('/charts/capture')
      .send({ ...CAPTURE_KEY, device: 'ipad' })
      .expect(400);

    expect(topCharts).not.toHaveBeenCalled();
  });

  it('lists the genres', async () => {
    const appStore = await api
      .get('/charts/genres')
      .query({ store: 'APP_STORE' })
      .expect(200);
    const genres = appStore.body as ChartGenre[];

    expect(genres).toHaveLength(42);
    expect(genres[0]).toEqual({
      id: 'overall',
      name: 'Overall',
      group: 'apps',
    });

    const play = await api
      .get('/charts/genres')
      .query({ store: 'GOOGLE_PLAY' })
      .expect(200);
    expect((play.body as ChartGenre[]).map((genre) => genre.id)).toContain(
      'GAME_PUZZLE',
    );

    await api.get('/charts/genres').expect(400);
    await api.get('/charts/genres').query({ store: 'OTHER' }).expect(400);
  });
});
