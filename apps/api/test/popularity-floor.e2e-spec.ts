import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import { AppDetail, TrackedKeywordItem, utcDayOf } from '@asobeast/shared';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ownerAgent, useCookies } from './helpers/session';
import { asWorkspace } from './helpers/tenancy';
import { testDb } from './helpers/test-db';
import { obliterateQueues, pauseQueues } from './obliterate-queues';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { ApplePopularityClient } from '../src/scoring/apple-popularity';
import { newestCompleteWeek } from '../src/scoring/apple-popularity.sync';
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

const FLOOR_TERM = 'puzzle game';
const ABSENT_TERM = 'geo trivia world';
const LISTED_TERM = 'mid puzzle';
const APP_STORE_URL = 'https://apps.apple.com/us/app/puzzle/id123456789';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const searchResults: SearchItem[] = Array.from({ length: 40 }, (_, index) => ({
  storeAppId: `${100 + index}`,
  title: index < 12 ? `Puzzle Game ${index}` : `Other App ${index}`,
  ratingCount: 20_000,
}));

const detailFor = (storeAppId: string): NormalizedApp => ({
  store: Store.APP_STORE,
  storeAppId,
  title: `Puzzle ${storeAppId}`,
  description: 'Fixture description',
  ratingCount: 20_000,
  ratingAvg: 4.4,
  storeUpdatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  raw: { source: 'fixture' },
  searchable: true,
});

class FakeRegistry {
  get(store: Store): StoreProvider {
    return {
      store,
      getApp: (storeAppId: string) => Promise.resolve(detailFor(storeAppId)),
      search: () => Promise.resolve(searchResults),
      suggest: (term: string): Promise<SuggestItem[]> =>
        Promise.resolve(
          FLOOR_TERM.startsWith(term.toLowerCase())
            ? [{ term: FLOOR_TERM }]
            : [],
        ),
      similar: () => Promise.resolve([] as SearchItem[]),
      topCharts: () => Promise.resolve([] as ChartItem[]),
      reviews: () => Promise.resolve([] as ReviewResult[]),
      availability: () => Promise.resolve([]),
      developerApps: () => Promise.resolve([] as SearchItem[]),
    };
  }
}

interface StoredStats {
  signals: Record<string, unknown>;
  evidence: Record<string, unknown>;
}

describe('Apple floor popularity answers (e2e)', () => {
  const newest = newestCompleteWeek(new Date());
  const sixWeeksAgo = new Date(newest.getTime() - 6 * WEEK_MS);
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
      .useValue(new FakeRegistry())
      .overrideProvider(ApplePopularityClient)
      .useValue({ enabled: true, weekOf: () => Promise.resolve([]) })
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
    await prisma.searchTermPopularity.deleteMany({ where: { country: 'us' } });
    await prisma.searchTermPopularity.createMany({
      data: [
        {
          country: 'us',
          term: FLOOR_TERM,
          week: newest,
          genre: 'GAMES',
          popularity: 41,
        },
        {
          country: 'us',
          term: 'mid puzzle',
          week: newest,
          genre: 'GAMES',
          popularity: 70,
        },
        {
          country: 'us',
          term: FLOOR_TERM,
          week: sixWeeksAgo,
          genre: 'GAMES',
          popularity: 60,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.searchTermPopularity.deleteMany({ where: { country: 'us' } });
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const scoredKeywords = async (): Promise<TrackedKeywordItem[]> => {
    const imported = await api
      .post('/apps')
      .send({ url: APP_STORE_URL })
      .expect(201);
    const appId = (imported.body as AppDetail).id;
    const added = await api
      .post(`/apps/${appId}/keywords`)
      .send({ keywords: [FLOOR_TERM, ABSENT_TERM, LISTED_TERM] })
      .expect(201);
    for (const item of added.body as TrackedKeywordItem[]) {
      await asWorkspace(app, () => scoring.scoreKeyword(item.keywordId));
    }
    const listed = await api.get(`/apps/${appId}/keywords`).expect(200);
    return listed.body as TrackedKeywordItem[];
  };

  const itemOf = (items: TrackedKeywordItem[], text: string) =>
    items.find((item) => item.text === text);

  it('answers a term listed at the floor with medium confidence', async () => {
    const floor = itemOf(await scoredKeywords(), FLOOR_TERM);

    expect(floor?.scoreSignals).toMatchObject({
      officialPopularity: 41,
      officialPopularityState: 'floor',
      officialPopularityFloor: 41,
      officialPopularityWeek: utcDayOf(newest),
      officialPopularityLastAboveFloor: {
        value: 60,
        week: utcDayOf(sixWeeksAgo),
      },
    });
    expect(floor?.scoreProvenance).toMatchObject({
      source: 'APPLE_ADS_POPULARITY',
      confidence: 'MEDIUM',
    });
  });

  it('answers a term Apple left out with the estimate source and medium confidence', async () => {
    const absent = itemOf(await scoredKeywords(), ABSENT_TERM);

    expect(absent?.scoreSignals).toMatchObject({
      officialPopularity: null,
      officialPopularityState: 'absent',
      officialPopularityFloor: 41,
    });
    expect(absent?.scoreProvenance).toMatchObject({
      source: 'APPLE_SEARCH_SIGNALS',
      confidence: 'MEDIUM',
    });
  });

  it('keeps high confidence for a term listed above the floor', async () => {
    const listed = itemOf(await scoredKeywords(), LISTED_TERM);

    expect(listed?.scoreSignals).toMatchObject({
      officialPopularity: 70,
      officialPopularityState: 'listed',
      officialPopularityFloor: 41,
      officialPopularityWeek: utcDayOf(newest),
    });
    expect(listed?.scoreSignals).not.toHaveProperty(
      'officialPopularityLastAboveFloor',
    );
    expect(listed?.scoreProvenance).toMatchObject({
      source: 'APPLE_ADS_POPULARITY',
      confidence: 'HIGH',
    });
  });

  it('stores the state in the signals and the evidence, never the raw answer', async () => {
    const floor = itemOf(await scoredKeywords(), FLOOR_TERM);
    const metric = await prisma.keywordMetric.findFirst({
      where: { keywordId: floor?.keywordId },
    });
    const stats = metric?.stats as unknown as StoredStats;

    expect(stats.signals.officialPopularityState).toBe('floor');
    expect(stats.evidence.officialPopularityState).toBe('floor');
    expect(stats).not.toHaveProperty('official');
  });
});
