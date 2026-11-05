import { execSync } from 'child_process';
import { join } from 'path';
import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import { Queue } from 'bullmq';
import { utcDayOf } from '@asobeast/shared';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { WorkspaceContext } from '../src/common/tenancy/workspace-context';
import { JOBS, QUEUES } from '../src/jobs/jobs.types';
import { KeywordDiscoveryPlanner } from '../src/keyword-discovery/discovery-planner.service';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { FakeRegistry } from './helpers/mcp-fixtures';
import { obliterateQueues, pauseQueues } from './obliterate-queues';
import { testDb } from './helpers/test-db';

const OTHER_WORKSPACE_ID = 'ws_discovery_other';
const STORE_APP_ID = '777000111';

describe('keyword discovery planner (e2e)', () => {
  jest.setTimeout(45_000);

  let app: INestApplication;
  let prisma: PrismaClient;
  let appId: string;

  const planIn = (workspaceId: string, id: string) =>
    app
      .get(WorkspaceContext)
      .run(workspaceId, () => app.get(KeywordDiscoveryPlanner).plan(id));

  const appStoreQueue = () =>
    app.get<Queue>(getQueueToken(QUEUES.APP_STORE), { strict: false });

  const seedApp = (
    workspaceId: string,
    storeAppId: string,
    extra: { primaryAppId?: string; isCompetitor?: boolean } = {},
  ) =>
    prisma.app.create({
      data: {
        workspaceId,
        store: Store.APP_STORE,
        storeAppId,
        country: 'us',
        name: storeAppId,
        ...extra,
      },
    });

  const seedListing = (id: string, title: string, subtitle: string | null) =>
    prisma.appSnapshot.create({
      data: {
        appId: id,
        title,
        subtitle,
        description: '',
        raw: { primaryGenreId: 6013 },
      },
    });

  const discoveriesOf = (id: string) =>
    prisma.keywordDiscovery.findMany({
      where: { appId: id },
      include: { keyword: true },
    });

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StoreProviderRegistry)
      .useValue(new FakeRegistry())
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = testDb();
    for (const id of [DEFAULT_WORKSPACE_ID, OTHER_WORKSPACE_ID]) {
      await prisma.workspace.upsert({
        where: { id },
        update: {},
        create: { id, name: id },
      });
    }
  }, 60_000);

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword", "SearchTermPopularity" RESTART IDENTITY CASCADE',
    );
    await obliterateQueues(app);
    await pauseQueues(app);
    appId = (await seedApp(DEFAULT_WORKSPACE_ID, STORE_APP_ID)).id;
    await seedListing(appId, 'Habit Tracker: Daily Goals', 'Build streaks');
    for (const [index, title] of [
      'Streaks Habit Planner',
      'Routine Habit Planner',
    ].entries()) {
      const competitor = await seedApp(DEFAULT_WORKSPACE_ID, `comp-${index}`, {
        primaryAppId: appId,
        isCompetitor: true,
      });
      await seedListing(competitor.id, title, null);
    }
    await prisma.review.createMany({
      data: Array.from({ length: 5 }, (_, index) => ({
        appId,
        reviewId: `review-${index}`,
        score: 4,
        text: `the focus timer keeps me going ${index}`,
        reviewedAt: new Date(),
      })),
    });
    const sibling = await seedApp(DEFAULT_WORKSPACE_ID, '777000222');
    const goals = await prisma.keyword.create({
      data: { text: 'habit goals', store: Store.APP_STORE, country: 'us' },
    });
    await prisma.trackedKeyword.create({
      data: { appId: sibling.id, keywordId: goals.id, source: 'MANUAL' },
    });
    await prisma.searchTermPopularity.create({
      data: {
        country: 'us',
        term: 'habit journal',
        week: new Date(`${utcDayOf(new Date())}T00:00:00.000Z`),
        genre: 'HEALTH_FITNESS',
        popularity: 55,
      },
    });
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword", "SearchTermPopularity" RESTART IDENTITY CASCADE',
    );
    await obliterateQueues(app);
    await app.close();
    await prisma.$disconnect();
  });

  it('stores the pool from every local source and queues prioritized checks', async () => {
    const result = await planIn(DEFAULT_WORKSPACE_ID, appId);

    const rows = await discoveriesOf(appId);
    const sources = new Set(rows.map(({ source }) => source));
    expect([...sources].sort()).toEqual([
      'competitors',
      'popularity',
      'portfolio',
      'reviews',
      'subtitle',
      'title',
    ]);
    expect(rows.map(({ keyword }) => keyword.text)).toEqual(
      expect.arrayContaining([
        'habit tracker',
        'habit planner',
        'focus timer',
        'habit goals',
        'habit journal',
      ]),
    );
    const prioritized = await appStoreQueue().getJobs(['prioritized']);
    expect(result.queued).toBe(Math.min(rows.length, 40));
    expect(prioritized).toHaveLength(result.queued);
    expect(
      prioritized.every(({ name }) => name === JOBS.DISCOVER_KEYWORD),
    ).toBe(true);
    expect(await appStoreQueue().getJobs(['paused', 'wait'])).toHaveLength(0);
  });

  it('queues nothing the second time in the same week', async () => {
    await planIn(DEFAULT_WORKSPACE_ID, appId);
    const queued = (await appStoreQueue().getJobs(['prioritized'])).length;

    await expect(planIn(DEFAULT_WORKSPACE_ID, appId)).resolves.toMatchObject({
      queued: 0,
    });
    expect(await appStoreQueue().getJobs(['prioritized'])).toHaveLength(queued);
  });

  it('resolves a candidate from a fresh capture without a job', async () => {
    const keyword = await prisma.keyword.create({
      data: { text: 'habit tracker', store: Store.APP_STORE, country: 'us' },
    });
    const today = new Date(`${utcDayOf(new Date())}T00:00:00.000Z`);
    await prisma.serpEntry.createMany({
      data: Array.from({ length: 50 }, (_, index) => ({
        keywordId: keyword.id,
        date: today,
        position: index + 1,
        storeAppId: index === 3 ? STORE_APP_ID : `seed-${index}`,
        title: `Seeded ${index}`,
      })),
    });

    const result = await planIn(DEFAULT_WORKSPACE_ID, appId);

    expect(result.resolved).toBe(1);
    const row = await prisma.keywordDiscovery.findUniqueOrThrow({
      where: { appId_keywordId: { appId, keywordId: keyword.id } },
    });
    expect(row).toMatchObject({ position: 4, depth: 50, checkedOn: today });
    expect(row.queuedAt).toBeNull();
    const jobs = await appStoreQueue().getJobs(['prioritized']);
    expect(
      jobs.some(
        ({ data }) => (data as { keywordId: string }).keywordId === keyword.id,
      ),
    ).toBe(false);
  });

  it('keeps one row per app for a phrase another workspace also discovers', async () => {
    const other = await seedApp(OTHER_WORKSPACE_ID, '888000111');
    await seedListing(other.id, 'Habit Tracker Pro', null);

    await planIn(DEFAULT_WORKSPACE_ID, appId);
    await planIn(OTHER_WORKSPACE_ID, other.id);

    const keywords = await prisma.keyword.findMany({
      where: { text: 'habit tracker', store: Store.APP_STORE, country: 'us' },
    });
    expect(keywords).toHaveLength(1);
    const rows = await prisma.keywordDiscovery.findMany({
      where: { keywordId: keywords[0]?.id },
      select: { appId: true, workspaceId: true },
    });
    expect(rows).toEqual(
      expect.arrayContaining([
        { appId, workspaceId: DEFAULT_WORKSPACE_ID },
        { appId: other.id, workspaceId: OTHER_WORKSPACE_ID },
      ]),
    );
    expect(rows).toHaveLength(2);
  });
});
