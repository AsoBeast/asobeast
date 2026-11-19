import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import { AppDetail, CompetitorItem } from '@asobeast/shared';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { obliterateQueues, settleBootRegistration } from './obliterate-queues';
import { testDb } from './helpers/test-db';
import { ownerAgent, useCookies } from './helpers/session';

const PLAY_RAW = {
  genreId: 'TRAVEL_AND_LOCAL',
  genre: 'Travel & Local',
  developerId: '5700313618786177705',
  developer: 'IHG',
  contentRating: 'Everyone',
  recentChanges: 'Faster booking',
};

const APP_STORE_RAW = {
  primaryGenreId: 6013,
  primaryGenre: 'Health & Fitness',
  artistId: 284882218,
  developer: 'Habit Labs',
  contentRating: '4+',
  releaseNotes: 'Bug fixes.',
};

const DATES = {
  releasedAt: new Date('2015-03-12T00:00:00.000Z'),
  storeUpdatedAt: new Date('2026-11-10T08:30:00.000Z'),
};

const PLAY_FACTS = {
  genre: 'TRAVEL_AND_LOCAL',
  genreName: 'Travel & Local',
  developer: 'IHG',
  developerId: '5700313618786177705',
  contentRating: 'Everyone',
  releasedAt: '2015-03-12T00:00:00.000Z',
  storeUpdatedAt: '2026-11-10T08:30:00.000Z',
};

const APP_STORE_FACTS = {
  genre: '6013',
  genreName: 'Health & Fitness',
  developer: 'Habit Labs',
  developerId: '284882218',
  contentRating: '4+',
  releasedAt: '2015-03-12T00:00:00.000Z',
  storeUpdatedAt: '2026-11-10T08:30:00.000Z',
};

const NO_FACTS = {
  genre: null,
  genreName: null,
  developer: null,
  developerId: null,
  contentRating: null,
  releasedAt: null,
  storeUpdatedAt: null,
};

interface ListingSeed {
  country?: string | null;
  raw?: object;
  description?: string;
  dated?: boolean;
  capturedAt?: string;
}

describe('listing facts on the app detail (e2e)', () => {
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

  const createApp = (store: Store, storeAppId: string, primaryAppId?: string) =>
    prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store,
        storeAppId,
        country: 'us',
        name: storeAppId,
        isCompetitor: primaryAppId !== undefined,
        primaryAppId,
      },
    });

  const addListing = (appId: string, seed: ListingSeed = {}) =>
    prisma.appSnapshot.create({
      data: {
        appId,
        country: seed.country ?? null,
        title: `${appId} title`,
        description: seed.description ?? `${appId} description`,
        raw: seed.raw ?? {},
        capturedAt: new Date(seed.capturedAt ?? '2026-11-01T00:00:00.000Z'),
        ...(seed.dated === false ? {} : DATES),
      },
    });

  const seedListing = async (
    store: Store,
    storeAppId: string,
    raw: object,
    primaryAppId?: string,
  ) => {
    const created = await createApp(store, storeAppId, primaryAppId);
    await addListing(created.id, { raw });
    return created;
  };

  const detailOf = async (id: string, query = '') =>
    (await api.get(`/apps/${id}${query}`).expect(200)).body as AppDetail;

  const competitorsOf = async (id: string) =>
    (await api.get(`/apps/${id}/competitors`).expect(200))
      .body as CompetitorItem[];

  it('answers the Google Play facts on the detail', async () => {
    const mine = await seedListing(Store.GOOGLE_PLAY, 'com.ihg', PLAY_RAW);

    expect((await detailOf(mine.id)).latestSnapshot).toMatchObject(PLAY_FACTS);
  });

  it('answers the App Store facts on the detail', async () => {
    const mine = await seedListing(Store.APP_STORE, '111', APP_STORE_RAW);

    expect((await detailOf(mine.id)).latestSnapshot).toMatchObject(
      APP_STORE_FACTS,
    );
  });

  it('gives a competitor the short facts on the detail and on the competitor list', async () => {
    const mine = await seedListing(Store.APP_STORE, '111', {
      ...APP_STORE_RAW,
      developer: 'Mine Labs',
    });
    await seedListing(Store.APP_STORE, '222', APP_STORE_RAW, mine.id);

    const detail = await detailOf(mine.id);
    const listed = await competitorsOf(mine.id);

    expect(detail.latestSnapshot?.developer).toBe('Mine Labs');
    expect(detail.competitors[0]?.latestSnapshot).toMatchObject(
      APP_STORE_FACTS,
    );
    expect(listed[0]?.latestSnapshot).toMatchObject(APP_STORE_FACTS);
  });

  it('answers the facts of a market listing on a market detail', async () => {
    const mine = await seedListing(Store.APP_STORE, '111', APP_STORE_RAW);
    const rival = await seedListing(
      Store.APP_STORE,
      '222',
      APP_STORE_RAW,
      mine.id,
    );
    await addListing(mine.id, {
      country: 'de',
      raw: { ...APP_STORE_RAW, contentRating: 'USK 12' },
      capturedAt: '2026-11-02T00:00:00.000Z',
    });
    await addListing(rival.id, {
      country: 'de',
      raw: { ...APP_STORE_RAW, contentRating: 'USK 16' },
      capturedAt: '2026-11-02T00:00:00.000Z',
    });

    const detail = await detailOf(mine.id, '?country=de');

    expect(detail.latestSnapshot).toMatchObject({
      ...APP_STORE_FACTS,
      country: 'de',
      contentRating: 'USK 12',
    });
    expect(detail.competitors[0]?.latestSnapshot).toMatchObject({
      country: 'de',
      contentRating: 'USK 16',
    });
  });

  it('answers null for a snapshot captured before the payload held these keys', async () => {
    const mine = await createApp(Store.GOOGLE_PLAY, 'com.old');
    await addListing(mine.id, { raw: { source: 'fixture' }, dated: false });

    const snapshot = (await detailOf(mine.id)).latestSnapshot;

    for (const [key, value] of Object.entries(NO_FACTS)) {
      expect(snapshot).toHaveProperty(key, value);
    }
    expect(JSON.stringify(snapshot)).not.toContain('Unknown');
  });
});
