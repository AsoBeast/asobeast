import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import { ApiErrorEnvelope, SerpSnapshot } from '@asobeast/shared';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { testDb } from './helpers/test-db';
import { ownerAgent, useCookies } from './helpers/session';
import { obliterateQueues, settleBootRegistration } from './obliterate-queues';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';

const DATE = new Date('2026-07-01T00:00:00.000Z');

describe('SerpController (e2e)', () => {
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
    await settleBootRegistration(app);

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

  it('returns a 404 envelope for an unknown keyword id', async () => {
    const response = await api.get('/keywords/missing/serp').expect(404);

    const body = response.body as ApiErrorEnvelope;
    expect(body.statusCode).toBe(404);
    expect(body.path).toBe('/keywords/missing/serp');
    expect(typeof body.message).toBe('string');
  });

  it('returns the latest snapshot with annotated entries', async () => {
    const you = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: 'self-store',
        country: 'us',
        name: 'You',
      },
    });
    await prisma.app.create({
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
      data: { appId: you.id, keywordId: keyword.id, source: 'MANUAL' },
    });
    await prisma.serpEntry.createMany({
      data: [
        {
          keywordId: keyword.id,
          date: DATE,
          position: 1,
          storeAppId: 'self-store',
          title: 'You',
          iconUrl: 'https://is1-ssl.mzstatic.com/image/thumb/a/100x100bb.jpg',
        },
        {
          keywordId: keyword.id,
          date: DATE,
          position: 2,
          storeAppId: 'rival-store',
          title: 'Rival Habit Tracker',
        },
        {
          keywordId: keyword.id,
          date: DATE,
          position: 3,
          storeAppId: 'other-store',
          title: 'Other',
        },
      ],
    });

    const response = await api.get(`/keywords/${keyword.id}/serp`).expect(200);

    const body = response.body as SerpSnapshot;
    expect(body.date).toBe('2026-07-01');
    expect(body.entries).toHaveLength(3);
    expect(body.entries[0]).toMatchObject({
      appId: you.id,
      isCompetitor: false,
    });
    expect(body.entries[1].isCompetitor).toBe(true);
    expect(body.entries[2]).toMatchObject({ appId: null, isCompetitor: false });
    expect(body.entries[0]).toMatchObject({
      iconUrl: 'https://is1-ssl.mzstatic.com/image/thumb/a/100x100bb.jpg',
      titleMatch: 'none',
      titleSegments: [{ text: 'You', match: 'none' }],
    });
    expect(body.entries[1]).toMatchObject({
      iconUrl: null,
      titleMatch: 'phrase',
      titleSegments: [
        { text: 'Rival ', match: 'none' },
        { text: 'Habit', match: 'exact' },
        { text: ' ', match: 'none' },
        { text: 'Tracker', match: 'exact' },
      ],
    });
  });

  async function appRow(
    storeAppId: string,
    country: string,
    primaryAppId?: string,
  ) {
    return prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId,
        country,
        name: storeAppId,
        isCompetitor: primaryAppId !== undefined,
        primaryAppId,
      },
    });
  }

  async function serpIn(
    trackerId: string,
    country: string,
    storeAppIds: string[],
  ) {
    const keyword = await prisma.keyword.create({
      data: { text: 'meditation', store: Store.APP_STORE, country },
    });
    await prisma.trackedKeyword.create({
      data: { appId: trackerId, keywordId: keyword.id, source: 'MANUAL' },
    });
    await prisma.serpEntry.createMany({
      data: storeAppIds.map((storeAppId, index) => ({
        keywordId: keyword.id,
        date: DATE,
        position: index + 1,
        storeAppId,
        title: storeAppId,
      })),
    });
    const response = await api.get(`/keywords/${keyword.id}/serp`).expect(200);
    return (response.body as SerpSnapshot).entries;
  }

  it('recognises your app and its competitors in a market other than home', async () => {
    const you = await appRow('self-store', 'us');
    const rival = await appRow('rival-store', 'us', you.id);

    const entries = await serpIn(you.id, 'de', [
      'self-store',
      'rival-store',
      'other-store',
    ]);

    expect(entries).toEqual([
      expect.objectContaining({ appId: you.id, isCompetitor: false }),
      expect.objectContaining({ appId: rival.id, isCompetitor: true }),
      expect.objectContaining({ appId: null, isCompetitor: false }),
    ]);
  });

  it('prefers the row of the keyword storefront when an app was imported twice', async () => {
    const you = await appRow('self-store', 'us');
    const german = await appRow('self-store', 'de');

    const entries = await serpIn(you.id, 'de', ['self-store']);

    expect(entries[0]).toMatchObject({ appId: german.id, isCompetitor: false });
  });

  it('prefers your own app over a competitor row of another storefront', async () => {
    const you = await appRow('self-store', 'us');
    const other = await appRow('other-primary', 'gb');
    await appRow('self-store', 'gb', other.id);

    const entries = await serpIn(you.id, 'de', ['self-store']);

    expect(entries[0]).toMatchObject({ appId: you.id, isCompetitor: false });
  });

  it('prefers the row of the keyword storefront over a primary of another storefront', async () => {
    await appRow('self-store', 'us');
    const other = await appRow('other-primary', 'de');
    const competitor = await appRow('self-store', 'de', other.id);

    const entries = await serpIn(other.id, 'de', ['self-store']);

    expect(entries[0]).toMatchObject({
      appId: competitor.id,
      isCompetitor: true,
    });
  });

  describe('movement and captured days', () => {
    const DAYS = ['2026-06-29', '2026-06-30', '2026-07-01'];

    async function threeCapturedDays() {
      const you = await appRow('self-store', 'us');
      const keyword = await prisma.keyword.create({
        data: { text: 'focus timer', store: Store.APP_STORE, country: 'us' },
      });
      await prisma.trackedKeyword.create({
        data: { appId: you.id, keywordId: keyword.id, source: 'MANUAL' },
      });
      const day = (date: string, storeAppIds: string[]) =>
        storeAppIds.map((storeAppId, index) => ({
          keywordId: keyword.id,
          date: new Date(`${date}T00:00:00.000Z`),
          position: index + 1,
          storeAppId,
          title: storeAppId,
        }));
      const deep = Array.from({ length: 9 }, (_, index) => `deep-${index + 1}`);
      await prisma.serpEntry.createMany({
        data: [
          ...day(DAYS[0], ['a', 'b', 'c']),
          ...day(DAYS[1], ['b', 'a', 'newcomer', ...deep]),
          ...day(DAYS[2], ['a', 'b', 'newcomer', ...deep]),
        ],
      });
      return keyword.id;
    }

    it('compares the newest day with the captured day before it', async () => {
      const keywordId = await threeCapturedDays();

      const response = await api.get(`/keywords/${keywordId}/serp`).expect(200);
      const body = response.body as SerpSnapshot;

      expect(body.date).toBe(DAYS[2]);
      expect(body.comparedTo).toBe(DAYS[1]);
      expect(body.dates).toEqual([...DAYS].reverse());
      expect(body.entries).toHaveLength(12);
      expect(body.entries[0]).toMatchObject({
        storeAppId: 'a',
        previous: 2,
        delta: -1,
        movement: 'up',
      });
      expect(body.entries[11]).toMatchObject({ movement: 'same', delta: 0 });
      expect(body.exits).toEqual([]);
    });

    it('answers the middle day by date with its exits and newcomers', async () => {
      const keywordId = await threeCapturedDays();

      const response = await api
        .get(`/keywords/${keywordId}/serp?date=${DAYS[1]}`)
        .expect(200);
      const body = response.body as SerpSnapshot;

      expect(body.date).toBe(DAYS[1]);
      expect(body.comparedTo).toBe(DAYS[0]);
      expect(body.entries[2]).toMatchObject({
        storeAppId: 'newcomer',
        previous: null,
        movement: 'new',
      });
      expect(body.entries[3]).toMatchObject({
        storeAppId: 'deep-1',
        movement: 'none',
      });
      expect(body.exits).toEqual([
        expect.objectContaining({ storeAppId: 'c', previous: 3 }),
      ]);
    });
  });

  describe('the snapshot date', () => {
    async function trackedKeywordWithSnapshotOn(date: string) {
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
        data: { text: 'meme maker', store: Store.APP_STORE, country: 'us' },
      });
      await prisma.trackedKeyword.create({
        data: { appId: you.id, keywordId: keyword.id, source: 'MANUAL' },
      });
      await prisma.serpEntry.create({
        data: {
          keywordId: keyword.id,
          date: new Date(`${date}T00:00:00.000Z`),
          position: 1,
          storeAppId: 'self-store',
          title: 'You',
        },
      });
      return keyword.id;
    }

    it.each(['2026-02-30', '2026-09-31'])(
      'refuses %s instead of answering the day it rolls over to',
      async (date) => {
        const keywordId = await trackedKeywordWithSnapshotOn('2026-03-02');

        await api.get(`/keywords/${keywordId}/serp?date=${date}`).expect(400);
      },
    );

    it('answers a leap day', async () => {
      const keywordId = await trackedKeywordWithSnapshotOn('2028-02-29');

      const response = await api
        .get(`/keywords/${keywordId}/serp?date=2028-02-29`)
        .expect(200);

      expect((response.body as SerpSnapshot).date).toBe('2028-02-29');
    });
  });

  describe('where the keyword sits', () => {
    const SHOWN = '2026-07-01';
    const LATER = '2026-07-03';
    const at = (instant: string) => new Date(instant);

    async function snapshotOf(
      appId: string,
      title: string,
      subtitle: string | null,
      capturedAt: Date,
      country: string | null = null,
    ) {
      await prisma.appSnapshot.create({
        data: {
          appId,
          country,
          title,
          subtitle,
          description: '',
          raw: {},
          capturedAt,
        },
      });
    }

    async function serpOf(
      store: Store,
      trackerId: string,
      rows: [string, string, string?][],
      date: string,
      country = 'us',
    ) {
      const keyword = await prisma.keyword.create({
        data: { text: 'habit tracker', store, country },
      });
      await prisma.trackedKeyword.create({
        data: { appId: trackerId, keywordId: keyword.id, source: 'MANUAL' },
      });
      await prisma.serpEntry.createMany({
        data: [SHOWN, LATER].flatMap((day) =>
          rows.map(([storeAppId, title, shortDescription], index) => ({
            keywordId: keyword.id,
            date: new Date(`${day}T00:00:00.000Z`),
            position: index + 1,
            storeAppId,
            title,
            ...(shortDescription === undefined ? {} : { shortDescription }),
          })),
        ),
      });
      const response = await api
        .get(`/keywords/${keyword.id}/serp?date=${date}`)
        .expect(200);
      return (response.body as SerpSnapshot).entries;
    }

    async function appStoreDay(date: string) {
      const you = await appRow('self-store', 'us');
      const split = await appRow('split-store', 'us', you.id);
      const without = await appRow('without-store', 'us', you.id);
      const away = await appRow('away-store', 'gb', you.id);
      await snapshotOf(
        you.id,
        'Streaks',
        'Habit tracker and planner',
        at('2026-06-30T08:00:00.000Z'),
      );
      await snapshotOf(
        split.id,
        'Habit Builder',
        'Tracker for streaks',
        at('2026-07-01T23:59:00.000Z'),
      );
      await snapshotOf(
        split.id,
        'Habit Builder',
        'Habit tracker daily',
        at('2026-07-02T00:00:00.000Z'),
      );
      await snapshotOf(
        without.id,
        'Daily Goals',
        'Plan your day',
        at('2026-06-30T08:00:00.000Z'),
      );
      await snapshotOf(
        away.id,
        'Away Planner',
        'Habit tracker abroad',
        at('2026-06-30T08:00:00.000Z'),
      );
      return serpOf(
        Store.APP_STORE,
        you.id,
        [
          ['unfollowed-title', 'Habit Tracker'],
          ['self-store', 'Streaks'],
          ['unfollowed-other', 'Streaks Pro'],
          ['away-store', 'Away Planner'],
          ['split-store', 'Habit Builder'],
          ['filler', 'Filler'],
          ['without-store', 'Daily Goals'],
        ],
        date,
      );
    }

    it('answers the subtitle and placement of your app and competitors', async () => {
      const entries = await appStoreDay(SHOWN);

      expect(entries[1]).toMatchObject({
        storeAppId: 'self-store',
        subtitle: 'Habit tracker and planner',
        placement: 'subtitle',
        subtitleSegments: [
          { text: 'Habit', match: 'exact' },
          { text: ' ', match: 'none' },
          { text: 'tracker', match: 'exact' },
          { text: ' and planner', match: 'none' },
        ],
      });
      expect(entries[4]).toMatchObject({
        storeAppId: 'split-store',
        subtitle: 'Tracker for streaks',
        placement: 'split',
      });
      expect(entries[6]).toMatchObject({
        storeAppId: 'without-store',
        subtitle: 'Plan your day',
        placement: 'none',
      });
    });

    it('judges an app you do not follow on its title alone', async () => {
      const entries = await appStoreDay(SHOWN);

      expect(entries[0]).toMatchObject({ placement: 'title' });
      expect(entries[0]).not.toHaveProperty('subtitle');
      expect(entries[2]).not.toHaveProperty('placement');
      expect(entries[2]).not.toHaveProperty('subtitle');
    });

    it('reads the listing captured by the end of the shown day', async () => {
      const shown = await appStoreDay(SHOWN);

      expect(shown[4].subtitle).toBe('Tracker for streaks');

      await prisma.$executeRawUnsafe(
        'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
      );
      const later = await appStoreDay(LATER);

      expect(later[4]).toMatchObject({
        subtitle: 'Habit tracker daily',
        placement: 'subtitle',
      });
    });

    it('knows no subtitle of a competitor followed only in another market', async () => {
      const entries = await appStoreDay(SHOWN);

      expect(entries[3].appId).not.toBeNull();
      expect(entries[3]).not.toHaveProperty('subtitle');
      expect(entries[3]).not.toHaveProperty('placement');
    });

    it('reads the market listing another record of the same app captured', async () => {
      const american = await appRow('self-store', 'us');
      const german = await appRow('self-store', 'de');
      await snapshotOf(
        american.id,
        'Streaks',
        'Habit tracker und Planer',
        at('2026-06-30T08:00:00.000Z'),
        'de',
      );
      await snapshotOf(
        german.id,
        'Streaks',
        'Gewohnheiten planen',
        at('2026-07-02T08:00:00.000Z'),
      );

      const entries = await serpOf(
        Store.APP_STORE,
        german.id,
        [['self-store', 'Streaks']],
        SHOWN,
        'de',
      );

      expect(entries[0]).toMatchObject({
        appId: german.id,
        subtitle: 'Habit tracker und Planer',
        placement: 'subtitle',
      });
    });

    describe('on Google Play', () => {
      async function playDay(rows: [string, string, string?][]) {
        const you = await prisma.app.create({
          data: {
            workspaceId: DEFAULT_WORKSPACE_ID,
            store: Store.GOOGLE_PLAY,
            storeAppId: 'com.self',
            country: 'us',
            name: 'You',
          },
        });
        await snapshotOf(
          you.id,
          'Streaks',
          'Habit tracker and planner',
          at('2026-06-30T08:00:00.000Z'),
        );
        return serpOf(Store.GOOGLE_PLAY, you.id, rows, SHOWN);
      }

      const listingLess = (entries: SerpSnapshot['entries']) =>
        entries.every(
          (entry) => !('subtitle' in entry) && !('subtitleSegments' in entry),
        );

      it('answers the short description and placement of every result', async () => {
        const entries = await playDay([
          ['com.both', 'Habit Tracker', 'Habit tracker for streaks'],
          ['com.self', 'Streaks', 'Plan your day'],
          ['com.desc', 'Streaks Pro', 'Habit tracker and planner'],
          ['com.split', 'Habit Builder', 'Tracker for streaks'],
          ['com.none', 'Daily Goals', 'Plan your day'],
        ]);

        expect(entries.map((entry) => entry.placement)).toEqual([
          'both',
          'none',
          'subtitle',
          'split',
          'none',
        ]);
        expect(entries.map((entry) => entry.shortDescription)).toEqual([
          'Habit tracker for streaks',
          'Plan your day',
          'Habit tracker and planner',
          'Tracker for streaks',
          'Plan your day',
        ]);
        expect(entries[2].shortDescriptionSegments).toEqual([
          { text: 'Habit', match: 'exact' },
          { text: ' ', match: 'none' },
          { text: 'tracker', match: 'exact' },
          { text: ' and planner', match: 'none' },
        ]);
        expect(listingLess(entries)).toBe(true);
      });

      it('reads rows from before the column existed as unknown', async () => {
        const entries = await playDay([
          ['com.title', 'Habit Tracker'],
          ['com.unknown', 'Streaks'],
        ]);

        expect(entries[0]).toMatchObject({ placement: 'title' });
        expect(entries[0]).not.toHaveProperty('shortDescription');
        expect(entries[1]).not.toHaveProperty('placement');
        expect(entries[1]).not.toHaveProperty('shortDescription');
        expect(entries.some((entry) => entry.placement === 'none')).toBe(false);
      });

      it('keeps a known result beside an unknown one', async () => {
        const entries = await playDay([
          ['com.known', 'Streaks', 'Habit tracker and planner'],
          ['com.blank', 'Streaks Pro'],
        ]);

        expect(entries[0].placement).toBe('subtitle');
        expect(entries[1]).not.toHaveProperty('placement');
      });

      it('never answers a short description on the App Store', async () => {
        const you = await appRow('self-store', 'us');

        const entries = await serpOf(
          Store.APP_STORE,
          you.id,
          [
            ['unfollowed-title', 'Habit Tracker', 'Plan your day'],
            ['self-store', 'Streaks', 'Plan your day'],
          ],
          SHOWN,
        );

        expect(
          entries.some(
            (entry) =>
              'shortDescription' in entry ||
              'shortDescriptionSegments' in entry,
          ),
        ).toBe(false);
      });
    });
  });
});
