import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { asWorkspace } from './helpers/tenancy';
import { testDb } from './helpers/test-db';
import { obliterateQueues, pauseQueues } from './obliterate-queues';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
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
    await app.init();
    await pauseQueues(app);

    prisma = testDb();
    scoring = app.get(ScoringService);
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
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
    expect(stats.suggest).toEqual({ prefixHitLength: 1 });
  });
});
