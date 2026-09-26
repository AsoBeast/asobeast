import { execSync } from 'child_process';
import { join } from 'path';
import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import { AppDetail, TrackedKeywordItem } from '@asobeast/shared';
import { Queue } from 'bullmq';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ownerAgent, useCookies } from './helpers/session';
import { asWorkspace } from './helpers/tenancy';
import { testDb } from './helpers/test-db';
import { obliterateQueues, pauseQueues } from './obliterate-queues';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { JOBS, QUEUES } from '../src/jobs/jobs.types';
import { StoreJobsHandler } from '../src/jobs/store-jobs.handler';
import { ScoringService } from '../src/scoring/scoring.service';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import {
  ChartItem,
  NormalizedApp,
  ReviewResult,
  SearchItem,
  StoreProvider,
  SuggestItem,
} from '../src/store-providers/types';

const KEYWORD = 'puzzle game';
const GOOGLE_PLAY_URL =
  'https://play.google.com/store/apps/details?id=com.example.puzzle';

const searchResults: SearchItem[] = Array.from({ length: 40 }, (_, index) => ({
  storeAppId: `app${index}`,
  title: index < 12 ? `Puzzle Game ${index}` : `Other App ${index}`,
}));

const detailFor = (storeAppId: string): NormalizedApp => ({
  store: Store.GOOGLE_PLAY,
  storeAppId,
  title: `Puzzle Game ${storeAppId}`,
  description: 'Fixture description',
  ratingCount: 20_000,
  ratingAvg: 4.4,
  installs: 5_000_000n,
  storeUpdatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  raw: { source: 'fixture' },
  searchable: true,
});

class FakeGplayRegistry {
  get(store: Store): StoreProvider {
    return {
      store,
      getApp: (storeAppId: string) => Promise.resolve(detailFor(storeAppId)),
      search: () => Promise.resolve(searchResults),
      suggest: (term: string): Promise<SuggestItem[]> =>
        Promise.resolve(
          KEYWORD.startsWith(term.toLowerCase()) ? [{ term: KEYWORD }] : [],
        ),
      similar: () => Promise.resolve([] as SearchItem[]),
      topCharts: () => Promise.resolve([] as ChartItem[]),
      reviews: () => Promise.resolve([] as ReviewResult[]),
    };
  }
}

describe('Scoring pipeline (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let scoring: ScoringService;
  let api: Awaited<ReturnType<typeof ownerAgent>>;

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
      .useValue(new FakeGplayRegistry())
      .compile();

    app = moduleFixture.createNestApplication();
    useCookies(app);
    await app.init();
    await pauseQueues(app);

    prisma = testDb();
    scoring = app.get(ScoringService);
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

  it('writes traffic and difficulty for a google play keyword', async () => {
    const keyword = await prisma.keyword.create({
      data: { text: KEYWORD, store: Store.GOOGLE_PLAY, country: 'us' },
    });

    await asWorkspace(app, () => scoring.scoreKeyword(keyword.id));

    const metric = await prisma.keywordMetric.findFirst({
      where: { keywordId: keyword.id },
    });

    expect(metric).not.toBeNull();
    expect(metric?.traffic).toBeGreaterThan(0);
    expect(metric?.difficulty).toBeGreaterThan(0);

    const stats = metric?.stats as { store: string; suggest: unknown };
    expect(stats.store).toBe('GOOGLE_PLAY');
    expect(stats.suggest).toEqual({
      status: 'hit',
      prefixLength: 1,
      position: 1,
    });
  });

  it('scores a keyword on demand and lists its v2 provenance', async () => {
    const imported = await api
      .post('/apps')
      .send({ url: GOOGLE_PLAY_URL })
      .expect(201);
    const appId = (imported.body as AppDetail).id;
    const added = await api
      .post(`/apps/${appId}/keywords`)
      .send({ keywords: [KEYWORD] })
      .expect(201);
    const keywordId = (added.body as TrackedKeywordItem[]).find(
      (item) => item.text === KEYWORD,
    )?.keywordId;

    await api.post(`/keywords/${keywordId}/score`).expect(202);
    const queue = app.get<Queue>(getQueueToken(QUEUES.GPLAY));
    const jobs = await queue.getJobs(['waiting', 'paused', 'prioritized']);
    const job = jobs.find(
      (queued) =>
        queued.name === JOBS.SCORE_KEYWORD &&
        (queued.data as { keywordId: string }).keywordId === keywordId,
    );
    expect(job).toBeDefined();
    if (job) {
      await app.get(StoreJobsHandler).handle(job);
    }

    const listed = await api.get(`/apps/${appId}/keywords`).expect(200);
    const scored = (listed.body as TrackedKeywordItem[]).find(
      (item) => item.keywordId === keywordId,
    );
    expect(scored?.volume).toBeGreaterThan(0);
    expect(scored?.difficulty).toBeGreaterThan(0);
    expect(scored?.scoreProvenance).toMatchObject({
      source: 'GOOGLE_PLAY_SUGGEST_REACH',
      formulaVersion: 'google-play-v3',
      confidence: 'HIGH',
    });
    const metric = await prisma.keywordMetric.findFirst({
      where: { keywordId },
    });
    expect(metric?.stats).toMatchObject({
      signals: { suggestReach: 'hit', flags: [] },
      evidence: { officialPopularityUsed: false },
    });
  });
});
