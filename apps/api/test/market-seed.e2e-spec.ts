import { execSync } from 'child_process';
import { join } from 'path';
import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import {
  ApiErrorEnvelope,
  AppDetail,
  MarketSeedResult,
  TrackedKeywordItem,
} from '@asobeast/shared';
import { Queue } from 'bullmq';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { OnDemandLimiter } from '../src/auth/on-demand.limiter';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import {
  firstRunCheckJobId,
  JOBS,
  QUEUES,
  utcDateKey,
} from '../src/jobs/jobs.types';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import {
  GERMAN,
  LocalizedRegistry,
  POLISH,
  US_APP_URL,
} from './helpers/localized-store';
import { ownerAgent, useCookies } from './helpers/session';
import { testDb } from './helpers/test-db';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

const RIVAL_URL = 'https://apps.apple.com/us/app/rival/id6657987210';

describe('Market seed (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;
  const registry = new LocalizedRegistry();

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
    registry.reset();
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword", "AppGroup" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const appStoreQueue = () =>
    app.get<Queue>(getQueueToken(QUEUES.APP_STORE), { strict: false });

  const queuedJobs = () =>
    appStoreQueue().getJobs(['wait', 'paused', 'delayed', 'prioritized']);

  const clearQueues = async () => {
    await obliterateQueues(app);
    await pauseQueues(app);
  };

  const importApp = async () => {
    const { id } = (
      await api.post('/apps').send({ url: US_APP_URL }).expect(201)
    ).body as AppDetail;
    await clearQueues();
    registry.calls.length = 0;
    return id;
  };

  const seed = (appId: string, country: string) =>
    api.post(`/apps/${appId}/market-seed`).send({ country });

  const seeded = async (appId: string, country: string) =>
    (await seed(appId, country).expect(200)).body as MarketSeedResult;

  const trackedIn = (appId: string, country: string) =>
    prisma.trackedKeyword.findMany({
      where: { appId, keyword: { country } },
      select: { keywordId: true, source: true, active: true },
    });

  it('tracks the title and subtitle phrases of the market listing', async () => {
    const appId = await importApp();
    registry.listings.set('de:default', GERMAN);

    const result = await seeded(appId, 'de');

    const tracked = await trackedIn(appId, 'de');
    expect(tracked.length).toBeGreaterThan(0);
    expect(result).toEqual({
      country: 'de',
      status: 'seeded',
      seeded: tracked.length,
      skipped: 0,
      cost: {
        store: 'APP_STORE',
        keywordMarkets: tracked.length,
        dailyRequests: tracked.length + 1,
      },
    } satisfies MarketSeedResult);
    for (const row of tracked) {
      expect(['TITLE', 'SUBTITLE']).toContain(row.source);
      expect(row.active).toBe(true);
    }
    const listed = (
      await api.get(`/apps/${appId}/keywords?country=de`).expect(200)
    ).body as TrackedKeywordItem[];
    expect(listed).toHaveLength(tracked.length);
    expect(listed.map((item) => item.text)).toContain('geo quiz');
    await expect(
      prisma.appSnapshot.count({ where: { appId, country: 'de' } }),
    ).resolves.toBe(1);
  });

  it('queues the first score and the first position check of every seeded keyword', async () => {
    const appId = await importApp();
    registry.listings.set('de:default', GERMAN);

    await seeded(appId, 'de');

    const ids = (await trackedIn(appId, 'de')).map((row) => row.keywordId);
    const jobs = await queuedJobs();
    const scored = jobs
      .filter((job) => job.name === JOBS.SCORE_KEYWORD)
      .map((job) => (job.data as { keywordId: string }).keywordId);
    const checked = jobs
      .filter((job) => job.name === JOBS.CHECK_KEYWORD)
      .map((job) => job.id);
    expect(scored.sort()).toEqual([...ids].sort());
    expect(checked.sort()).toEqual(
      ids
        .map((keywordId) => firstRunCheckJobId(appId, keywordId, utcDateKey()))
        .sort(),
    );
  });

  it('seeds nothing twice', async () => {
    const appId = await importApp();
    registry.listings.set('de:default', GERMAN);
    const first = await seeded(appId, 'de');

    const second = await seeded(appId, 'de');

    expect(second).toMatchObject({
      status: 'seeded',
      seeded: 0,
      skipped: 0,
      cost: { keywordMarkets: 0, dailyRequests: 0 },
    });
    await expect(trackedIn(appId, 'de')).resolves.toHaveLength(first.seeded);
  });

  it("asks for the competitors' listing in that market", async () => {
    const appId = await importApp();
    await api
      .post(`/apps/${appId}/competitors`)
      .send({ url: RIVAL_URL })
      .expect(201);
    const rival = await prisma.app.findFirstOrThrow({
      where: { isCompetitor: true },
      select: { id: true },
    });
    await clearQueues();
    registry.listings.set('de:default', GERMAN);

    const result = await seeded(appId, 'de');

    const refreshes = (await queuedJobs())
      .filter((job) => job.name === JOBS.REFRESH_APP)
      .map((job) => job.data as { appId: string; country?: string });
    expect(refreshes).toEqual([
      expect.objectContaining({ appId: rival.id, country: 'de' }),
    ]);
    expect(result.cost.dailyRequests).toBe(result.seeded + 2);
  });

  it('answers unavailable and writes nothing where the app is not published', async () => {
    const appId = await importApp();
    registry.unlisted.add('jp');
    const consume = jest.spyOn(app.get(OnDemandLimiter), 'consume');

    const result = await seeded(appId, 'jp');

    const spent = consume.mock.calls.length;
    consume.mockRestore();
    expect(spent).toBe(1);

    expect(result).toEqual({
      country: 'jp',
      status: 'unavailable',
      seeded: 0,
      skipped: 0,
      cost: { store: 'APP_STORE', keywordMarkets: 0, dailyRequests: 0 },
    } satisfies MarketSeedResult);
    await expect(
      prisma.appSnapshot.count({ where: { appId, country: 'jp' } }),
    ).resolves.toBe(0);
    await expect(trackedIn(appId, 'jp')).resolves.toEqual([]);
  });

  it('refuses the home market, a competitor and a code that is not a storefront', async () => {
    const appId = await importApp();
    await api
      .post(`/apps/${appId}/competitors`)
      .send({ url: RIVAL_URL })
      .expect(201);
    const rival = await prisma.app.findFirstOrThrow({
      where: { isCompetitor: true },
      select: { id: true },
    });
    registry.calls.length = 0;

    await seed(appId, 'us').expect(400);
    await seed(rival.id, 'de').expect(400);
    const unknown = await seed(appId, 'zz').expect(400);
    expect((unknown.body as ApiErrorEnvelope).message).toBe(
      'zz is not an App Store storefront',
    );
    await seed('no-such-app', 'de').expect(404);
    await api.post(`/apps/${appId}/market-seed`).send({}).expect(400);
    expect(registry.calls).toEqual([]);
  });

  it("records the market's native localizations when it has them", async () => {
    const appId = await importApp();
    registry.listings.set('pl:pl', POLISH);

    const result = await seeded(appId, 'pl');

    expect(result.status).toBe('seeded');
    await expect(
      prisma.appSnapshot.count({
        where: { appId, country: 'pl', localization: 'pl' },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.appLocalization.findMany({
        where: { appId },
        select: { localization: true, origin: true },
      }),
    ).resolves.toEqual([{ localization: 'pl', origin: 'detected' }]);
    const texts = (
      await prisma.keyword.findMany({
        where: { country: 'pl', tracked: { some: { appId } } },
        select: { text: true },
      })
    ).map((row) => row.text);
    expect(texts).toContain('quiz geograficzny');
  });

  it('queues the localization probes of the seeded market', async () => {
    const appId = await importApp();

    await seeded(appId, 'ch');

    const probes = (await appStoreQueue().getJobs(['prioritized']))
      .filter((job) => job.name === JOBS.DETECT_LOCALIZATION)
      .map((job) => job.data as { country: string; localization: string })
      .filter((probe) => probe.country === 'ch');
    expect(probes.map((probe) => probe.localization).sort()).toEqual([
      'en-GB',
      'it',
    ]);
  });

  it('seeds the phrases of a localization the app ships that the storefront reads', async () => {
    const appId = await importApp();
    await api
      .post(`/apps/${appId}/localizations`)
      .send({ localization: 'fr' })
      .expect(201);
    registry.listings.set('ch:default', GERMAN);
    registry.listings.set('ch:fr', {
      title: 'Où suis-je? Quiz Géographique',
      subtitle: 'Carte du Monde',
      description: 'Découvrez le monde',
      screenshots: [],
    });

    await seeded(appId, 'ch');

    const texts = (
      await prisma.keyword.findMany({
        where: { country: 'ch', tracked: { some: { appId } } },
        select: { text: true },
      })
    ).map((row) => row.text);
    expect(texts).toEqual(
      expect.arrayContaining(['quiz géographique', 'geo quiz']),
    );
  });
});
