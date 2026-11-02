import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import { ApiErrorEnvelope, AppDetail, ListingMarket } from '@asobeast/shared';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { obliterateQueues, settleBootRegistration } from './obliterate-queues';
import { testDb } from './helpers/test-db';
import { ownerAgent, useCookies } from './helpers/session';

describe('listing reads per market (e2e)', () => {
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

  const listing = (
    appId: string,
    country: string | null,
    title: string,
    capturedAt: string,
    extra: {
      ratingAvg?: number;
      ratingCount?: number;
      localization?: string;
    } = {},
  ) => ({
    appId,
    country,
    title,
    description: `${title} description`,
    raw: {},
    capturedAt: new Date(capturedAt),
    ...extra,
  });

  const createApp = (storeAppId: string, primaryAppId?: string) =>
    prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId,
        country: 'us',
        name: primaryAppId ? 'Rival' : 'Mine',
        isCompetitor: primaryAppId !== undefined,
        primaryAppId,
      },
    });

  const seed = async () => {
    const mine = await createApp('111');
    const rival = await createApp('222', mine.id);
    await prisma.appSnapshot.createMany({
      data: [
        listing(mine.id, null, 'Habit Tracker', '2026-07-01T00:00:00.000Z'),
        listing(
          mine.id,
          'de',
          'Gewohnheits Tracker',
          '2026-07-02T00:00:00.000Z',
        ),
        listing(rival.id, null, 'Rival Home', '2026-07-01T00:00:00.000Z'),
        listing(rival.id, 'de', 'Rival Deutsch', '2026-07-02T00:00:00.000Z'),
      ],
    });
    return { mine, rival };
  };

  it('answers detail without a market from the home listing', async () => {
    const { mine } = await seed();

    const response = await api.get(`/apps/${mine.id}`).expect(200);

    const body = response.body as AppDetail;
    expect(body.latestSnapshot?.title).toBe('Habit Tracker');
    expect(body.latestSnapshot?.country).toBe('us');
    expect(body.competitors[0].latestSnapshot?.title).toBe('Rival Home');
  });

  it('answers detail from a market listing, competitors included', async () => {
    const { mine } = await seed();

    const response = await api.get(`/apps/${mine.id}?country=de`).expect(200);

    const body = response.body as AppDetail;
    expect(body.country).toBe('us');
    expect(body.latestSnapshot?.title).toBe('Gewohnheits Tracker');
    expect(body.latestSnapshot?.country).toBe('de');
    expect(body.competitors[0].latestSnapshot?.title).toBe('Rival Deutsch');
  });

  it('answers 404 for a storefront with no captured listing', async () => {
    const { mine } = await seed();

    const response = await api.get(`/apps/${mine.id}?country=fr`).expect(404);

    expect((response.body as ApiErrorEnvelope).message).toContain('fr');
  });

  it('answers 400 for a code that is not a storefront', async () => {
    const { mine } = await seed();

    await api.get(`/apps/${mine.id}?country=zz`).expect(400);
  });

  it('lists the markets that have a listing, home first', async () => {
    const { mine } = await seed();

    const response = await api
      .get(`/apps/${mine.id}/listing-markets`)
      .expect(200);

    expect(response.body as ListingMarket[]).toEqual([
      {
        country: 'us',
        home: true,
        capturedAt: '2026-07-01T00:00:00.000Z',
        tracked: true,
        ratingAvg: null,
        ratingCount: null,
      },
      {
        country: 'de',
        home: false,
        capturedAt: '2026-07-02T00:00:00.000Z',
        tracked: false,
        ratingAvg: null,
        ratingCount: null,
      },
    ]);
  });

  it('says which listed markets still track keywords', async () => {
    const { mine, rival } = await seed();
    await prisma.appSnapshot.createMany({
      data: [
        listing(mine.id, 'fr', 'Suivi', '2026-07-03T00:00:00.000Z'),
        listing(rival.id, 'fr', 'Rival Suivi', '2026-07-03T00:00:00.000Z'),
      ],
    });
    const keyword = await prisma.keyword.create({
      data: { text: 'gewohnheit', store: Store.APP_STORE, country: 'de' },
    });
    await prisma.trackedKeyword.create({
      data: {
        appId: mine.id,
        keywordId: keyword.id,
        source: 'MANUAL',
        active: false,
      },
    });

    const tracked = async (appId: string) =>
      (
        (await api.get(`/apps/${appId}/listing-markets`).expect(200))
          .body as ListingMarket[]
      ).map((market) => [market.country, market.tracked]);

    await expect(tracked(mine.id)).resolves.toEqual([
      ['us', true],
      ['de', true],
      ['fr', false],
    ]);
    await expect(tracked(rival.id)).resolves.toEqual([
      ['us', true],
      ['de', true],
      ['fr', false],
    ]);
  });

  it('lists only the home market of an app with one listing', async () => {
    await seed();
    const other = await createApp('333');
    await prisma.appSnapshot.create({
      data: listing(other.id, null, 'Other', '2026-07-01T00:00:00.000Z'),
    });

    const response = await api
      .get(`/apps/${other.id}/listing-markets`)
      .expect(200);

    expect(response.body as ListingMarket[]).toEqual([
      {
        country: 'us',
        home: true,
        capturedAt: '2026-07-01T00:00:00.000Z',
        tracked: true,
        ratingAvg: null,
        ratingCount: null,
      },
    ]);
  });

  const ratings = async (appId: string) =>
    (
      (await api.get(`/apps/${appId}/listing-markets`).expect(200))
        .body as ListingMarket[]
    ).map(({ country, capturedAt, ratingAvg, ratingCount }) => ({
      country,
      capturedAt,
      ratingAvg,
      ratingCount,
    }));

  const seedRated = async () => {
    const mine = await createApp('111');
    await prisma.appSnapshot.createMany({
      data: [
        listing(mine.id, null, 'Old', '2026-06-01T00:00:00.000Z', {
          ratingAvg: 4.0,
          ratingCount: 100,
        }),
        listing(mine.id, null, 'New', '2026-07-01T00:00:00.000Z', {
          ratingAvg: 4.8,
          ratingCount: 24000,
        }),
        listing(mine.id, 'de', 'Deutsch', '2026-07-02T00:00:00.000Z', {
          ratingAvg: 4.4,
          ratingCount: 5200,
        }),
      ],
    });
    return mine;
  };

  it('answers the newest rating of each market', async () => {
    const mine = await seedRated();

    await expect(ratings(mine.id)).resolves.toEqual([
      {
        country: 'us',
        capturedAt: '2026-07-01T00:00:00.000Z',
        ratingAvg: 4.8,
        ratingCount: 24000,
      },
      {
        country: 'de',
        capturedAt: '2026-07-02T00:00:00.000Z',
        ratingAvg: 4.4,
        ratingCount: 5200,
      },
    ]);
  });

  it('never answers the rating of a localized listing', async () => {
    const mine = await seedRated();
    await prisma.appSnapshot.create({
      data: listing(mine.id, 'de', 'Lokal', '2026-07-03T00:00:00.000Z', {
        ratingAvg: 1.0,
        ratingCount: 1,
        localization: 'de',
      }),
    });

    const markets = await ratings(mine.id);

    expect(markets[1]).toEqual({
      country: 'de',
      capturedAt: '2026-07-02T00:00:00.000Z',
      ratingAvg: 4.4,
      ratingCount: 5200,
    });
  });

  it('keeps the ratings of another app out', async () => {
    const mine = await seedRated();
    const rival = await createApp('222', mine.id);
    await prisma.appSnapshot.createMany({
      data: [
        listing(rival.id, null, 'Rival', '2026-07-01T00:00:00.000Z'),
        listing(rival.id, 'de', 'Rivale', '2026-07-02T00:00:00.000Z', {
          ratingAvg: 3.0,
          ratingCount: 10,
        }),
      ],
    });

    const own = await ratings(mine.id);
    const theirs = await ratings(rival.id);

    expect(own[1]).toMatchObject({ ratingAvg: 4.4, ratingCount: 5200 });
    expect(theirs[1]).toMatchObject({ ratingAvg: 3.0, ratingCount: 10 });
  });

  it('answers no rating for a market the store gave none for', async () => {
    const mine = await seedRated();
    await prisma.appSnapshot.create({
      data: listing(mine.id, 'fr', 'Suivi', '2026-07-03T00:00:00.000Z'),
    });

    const markets = await ratings(mine.id);

    expect(markets[2]).toEqual({
      country: 'fr',
      capturedAt: '2026-07-03T00:00:00.000Z',
      ratingAvg: null,
      ratingCount: null,
    });
  });

  it('answers the home market of an app with no listing without a rating', async () => {
    const mine = await createApp('111');

    const response = await api
      .get(`/apps/${mine.id}/listing-markets`)
      .expect(200);

    expect(response.body as ListingMarket[]).toEqual([
      {
        country: 'us',
        home: true,
        capturedAt: null,
        tracked: true,
        ratingAvg: null,
        ratingCount: null,
      },
    ]);
  });

  it('answers 404 for the markets of an unknown app', async () => {
    const response = await api.get('/apps/missing/listing-markets').expect(404);

    expect((response.body as ApiErrorEnvelope).path).toBe(
      '/apps/missing/listing-markets',
    );
  });
});
