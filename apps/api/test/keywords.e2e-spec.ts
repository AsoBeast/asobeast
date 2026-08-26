import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import {
  ApiErrorEnvelope,
  AppDetail,
  KeywordFieldResult,
  KeywordSuggestion,
  SpiderEnqueueResult,
  SpiderStatus,
  TrackedKeywordItem,
} from '@asobeast/shared';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { asWorkspace } from './helpers/tenancy';
import { testDb } from './helpers/test-db';
import { ownerAgent, useCookies } from './helpers/session';
import { obliterateQueues, pauseQueues } from './obliterate-queues';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { SpiderService } from '../src/keywords/spider.service';
import { RankingsService } from '../src/rankings/rankings.service';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { NormalizedApp, StoreProvider } from '../src/store-providers/types';

const FIXTURE: NormalizedApp = {
  store: Store.APP_STORE,
  storeAppId: '1234567890',
  title: 'Habit Tracker',
  subtitle: 'Daily streak counter',
  summary: 'A markdown journal',
  description: 'Fixture description',
  raw: { source: 'fixture', artistId: 284882218 },
};

const APP_STORE_URL = 'https://apps.apple.com/us/app/fixture/id1234567890';

const PLAY_SERP = [
  {
    storeAppId: 'com.example.game',
    title: 'Idle Tower Defense',
    developer: 'Fixture Studio',
    ratingAvg: 4.5,
  },
  { storeAppId: 'com.other.game', title: 'Rival Tower', developer: 'Rival' },
];

class FakeRegistry {
  suggestCalls: Array<{ term: string; country: string | undefined }> = [];

  get(store: Store): StoreProvider {
    return {
      store,
      getApp: () => Promise.resolve(FIXTURE),
      search: () =>
        Promise.resolve(store === Store.GOOGLE_PLAY ? PLAY_SERP : []),
      suggest: (term: string, country?: string) => {
        this.suggestCalls.push({ term, country });
        return Promise.resolve([
          { term: 'productivity', priority: 6000 },
          { term: 'habit tracker app', priority: 8000 },
          { term: 'habit', priority: 9000 },
        ]);
      },
      similar: () =>
        Promise.resolve([
          { storeAppId: '1', title: 'Streak Master Planner' },
          { storeAppId: '2', title: 'Daily Planner Pro' },
        ]),
      developerApps: (devId: string) =>
        Promise.resolve(
          devId === '284882218'
            ? [
                { storeAppId: '7', title: 'Focus Timer Studio' },
                { storeAppId: '8', title: 'Sleep Timer Studio' },
              ]
            : [],
        ),
    };
  }
}

describe('KeywordsController (e2e)', () => {
  const registry = new FakeRegistry();
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;

  const importApp = async (): Promise<string> => {
    const response = await api
      .post('/apps')
      .send({ url: APP_STORE_URL })
      .expect(201);
    return (response.body as AppDetail).id;
  };

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
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  it('auto tracks title and subtitle keywords but not description', async () => {
    const id = await importApp();

    const response = await api.get(`/apps/${id}/keywords`).expect(200);
    const items = response.body as TrackedKeywordItem[];

    const bySource = (source: string) =>
      items.filter((item) => item.source === source).map((item) => item.text);

    expect(bySource('TITLE')).toContain('habit');
    expect(bySource('SUBTITLE')).toContain('streak');
    expect(items.some((item) => item.source === 'DESCRIPTION')).toBe(false);
    for (const item of items) {
      expect(item.latestPosition).toBeNull();
      expect(item.latestDepth).toBeNull();
      expect(item.opportunity).toBeNull();
    }
  });

  it('adds, toggles and removes manual keywords', async () => {
    const id = await importApp();

    const added = await api
      .post(`/apps/${id}/keywords`)
      .send({ keywords: ['Habit Builder', 'streak counter'] })
      .expect(201);
    const manual = (added.body as TrackedKeywordItem[]).find(
      (item) => item.text === 'habit builder',
    );
    expect(manual).toBeDefined();
    expect(manual?.source).toBe('MANUAL');

    await api
      .patch(`/apps/${id}/keywords/${manual?.keywordId}`)
      .send({ active: false })
      .expect(200);

    const afterToggle = await api.get(`/apps/${id}/keywords`).expect(200);
    expect(
      (afterToggle.body as TrackedKeywordItem[]).find(
        (item) => item.keywordId === manual?.keywordId,
      )?.active,
    ).toBe(false);

    const relevanceResponse = await api
      .patch(`/apps/${id}/keywords/${manual?.keywordId}`)
      .send({ relevance: 95 })
      .expect(200);
    expect((relevanceResponse.body as TrackedKeywordItem).relevance).toBe(95);

    await api
      .patch(`/apps/${id}/keywords/${manual?.keywordId}`)
      .send({ relevance: 150 })
      .expect(400);

    await api.delete(`/apps/${id}/keywords/${manual?.keywordId}`).expect(204);

    const afterDelete = await api.get(`/apps/${id}/keywords`).expect(200);
    expect(
      (afterDelete.body as TrackedKeywordItem[]).some(
        (item) => item.keywordId === manual?.keywordId,
      ),
    ).toBe(false);
    expect(
      await prisma.keyword.count({ where: { text: 'habit builder' } }),
    ).toBe(1);
  });

  it('tracks keywords per market under a single app', async () => {
    const id = await importApp();

    const added = await api
      .post(`/apps/${id}/keywords`)
      .send({ keywords: ['aplikacja treningowa'], country: 'pl' })
      .expect(201);
    const pl = (added.body as TrackedKeywordItem[]).find(
      (item) => item.text === 'aplikacja treningowa',
    );
    expect(pl?.country).toBe('pl');

    const plOnly = await api
      .get(`/apps/${id}/keywords`)
      .query({ country: 'pl' })
      .expect(200);
    const plItems = plOnly.body as TrackedKeywordItem[];
    expect(plItems).toHaveLength(1);
    expect(plItems[0].country).toBe('pl');

    const usOnly = await api
      .get(`/apps/${id}/keywords`)
      .query({ country: 'us' })
      .expect(200);
    const usItems = usOnly.body as TrackedKeywordItem[];
    expect(usItems.length).toBeGreaterThan(0);
    expect(usItems.every((item) => item.country === 'us')).toBe(true);

    const countries = await api
      .get(`/apps/${id}/keyword-countries`)
      .expect(200);
    const summary = countries.body as {
      country: string;
      keywordCount: number;
    }[];
    expect(summary[0].country).toBe('us');
    expect(summary.find((row) => row.country === 'pl')?.keywordCount).toBe(1);

    expect(
      await prisma.keyword.count({
        where: { text: 'aplikacja treningowa', country: 'pl' },
      }),
    ).toBe(1);
  });

  it('rejects an invalid market code', async () => {
    const id = await importApp();

    await api
      .post(`/apps/${id}/keywords`)
      .send({ keywords: ['habit'], country: 'deu' })
      .expect(400);
  });

  it('round trips the ios keyword field with character accounting', async () => {
    const id = await importApp();

    const first = await api
      .put(`/apps/${id}/keyword-field`)
      .send({ text: 'habit,tracker,streak,habit' })
      .expect(200);
    const firstBody = first.body as KeywordFieldResult;

    expect(firstBody.charactersLimit).toBe(100);
    expect(firstBody.duplicatesRemoved).toBe(1);
    expect(firstBody.charactersUsed).toBe('habit,tracker,streak'.length);
    expect(firstBody.tracked.map((item) => item.text).sort()).toEqual([
      'habit',
      'streak',
      'tracker',
    ]);
    for (const item of firstBody.tracked) {
      expect(item.source).toBe('KEYWORD_FIELD');
      expect(item.active).toBe(true);
      expect(item).toHaveProperty('volume');
      expect(item).toHaveProperty('relevance');
      expect(item).toHaveProperty('bucket');
    }

    const second = await api
      .put(`/apps/${id}/keyword-field`)
      .send({ text: 'habit,goals' })
      .expect(200);
    const secondBody = second.body as KeywordFieldResult;

    expect(secondBody.tracked.map((item) => item.text).sort()).toEqual([
      'goals',
      'habit',
    ]);

    const deactivated = await prisma.trackedKeyword.findMany({
      where: { appId: id, source: 'KEYWORD_FIELD', active: false },
      include: { keyword: true },
    });
    expect(deactivated.map((row) => row.keyword.text).sort()).toEqual([
      'streak',
      'tracker',
    ]);
  });

  it('reads back the stored ios keyword field with the same accounting', async () => {
    const id = await importApp();

    const written = await api
      .put(`/apps/${id}/keyword-field`)
      .send({ text: 'habit,tracker,streak,habit' })
      .expect(200);
    const writtenBody = written.body as KeywordFieldResult;

    const read = await api.get(`/apps/${id}/keyword-field`).expect(200);
    const readBody = read.body as KeywordFieldResult;

    expect(readBody.tracked.map((item) => item.text).sort()).toEqual([
      'habit',
      'streak',
      'tracker',
    ]);
    expect(readBody.charactersUsed).toBe(writtenBody.charactersUsed);
    expect(readBody.charactersLimit).toBe(writtenBody.charactersLimit);
    expect(readBody.duplicatesRemoved).toBe(0);
    expect(readBody.tracked.every((item) => item.active)).toBe(true);

    await api
      .put(`/apps/${id}/keyword-field`)
      .send({ text: 'habit' })
      .expect(200);

    const afterShrink = await api.get(`/apps/${id}/keyword-field`).expect(200);
    const shrunk = afterShrink.body as KeywordFieldResult;

    expect(shrunk.tracked.map((item) => item.text)).toEqual(['habit']);
    expect(shrunk.charactersUsed).toBe('habit'.length);
  });

  it('reads an empty keyword field for an app that never had one', async () => {
    const id = await importApp();

    const response = await api.get(`/apps/${id}/keyword-field`).expect(200);

    expect(response.body as KeywordFieldResult).toEqual({
      tracked: [],
      charactersUsed: 0,
      charactersLimit: 100,
      duplicatesRemoved: 0,
    });
  });

  it('refuses to read the keyword field of a google play app', async () => {
    const play = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.GOOGLE_PLAY,
        storeAppId: 'com.example.game',
        country: 'us',
        name: 'Idle Tower Defense',
      },
    });

    const read = await api.get(`/apps/${play.id}/keyword-field`).expect(400);
    const write = await api
      .put(`/apps/${play.id}/keyword-field`)
      .send({ text: 'tower defense' })
      .expect(400);

    expect((read.body as ApiErrorEnvelope).message).toBe(
      'The keyword field is only available for App Store apps',
    );
    expect((write.body as ApiErrorEnvelope).message).toBe(
      (read.body as ApiErrorEnvelope).message,
    );
  });

  it('answers 404 for the keyword field of a missing app', async () => {
    await api.get('/apps/missing-app/keyword-field').expect(404);
  });

  it('sorts tracked keywords by serp volatility with nulls last', async () => {
    const id = await importApp();

    const added = await api
      .post(`/apps/${id}/keywords`)
      .send({ keywords: ['stable term', 'churn term', 'unchecked term'] })
      .expect(201);
    const items = added.body as TrackedKeywordItem[];
    const keywordId = (text: string) =>
      items.find((item) => item.text === text)!.keywordId;

    const day = (date: string, kwId: string, storeAppIds: string[]) =>
      storeAppIds.map((storeAppId, index) => ({
        keywordId: kwId,
        date: new Date(date),
        position: index + 1,
        storeAppId,
        title: storeAppId,
      }));

    await prisma.serpEntry.createMany({
      data: [
        ...day('2026-07-07', keywordId('stable term'), ['a', 'b']),
        ...day('2026-07-08', keywordId('stable term'), ['a', 'b']),
        ...day('2026-07-07', keywordId('churn term'), ['a', 'b']),
        ...day('2026-07-08', keywordId('churn term'), ['x', 'y']),
      ],
    });

    const response = await api
      .get(`/apps/${id}/keywords`)
      .query({ sort: 'volatility' })
      .expect(200);
    const sorted = response.body as TrackedKeywordItem[];

    expect(sorted[0].text).toBe('churn term');
    expect(sorted[0].serpVolatility7d).toBe(100);
    expect(sorted[1].text).toBe('stable term');
    expect(sorted[1].serpVolatility7d).toBe(0);
    expect(
      sorted.slice(2).every((item) => item.serpVolatility7d === null),
    ).toBe(true);
  });

  it('suggests untracked metadata candidates by default', async () => {
    const id = await importApp();

    const response = await api
      .get(`/apps/${id}/keywords/suggestions`)
      .expect(200);
    const suggestions = response.body as KeywordSuggestion[];
    const texts = suggestions.map((item) => item.text);

    expect(suggestions.every((item) => item.strategy === 'metadata')).toBe(
      true,
    );
    expect(texts).toContain('markdown');
    expect(texts).not.toContain('habit');
  });

  it('still suggests a phrase the app tracks only in another market', async () => {
    const id = await importApp();

    await api
      .post(`/apps/${id}/keywords`)
      .send({ keywords: ['markdown'], country: 'de' })
      .expect(201);

    const german = await api
      .get(`/apps/${id}/keywords/suggestions`)
      .query({ country: 'de' })
      .expect(200);
    expect(
      (german.body as KeywordSuggestion[]).map((item) => item.text),
    ).not.toContain('markdown');

    const home = await api.get(`/apps/${id}/keywords/suggestions`).expect(200);
    expect(
      (home.body as KeywordSuggestion[]).map((item) => item.text),
    ).toContain('markdown');
  });

  it('suggests autocomplete terms with priority for the search strategy', async () => {
    const id = await importApp();

    const response = await api
      .get(`/apps/${id}/keywords/suggestions`)
      .query({ strategy: 'search' })
      .expect(200);
    const suggestions = response.body as KeywordSuggestion[];

    const productivity = suggestions.find(
      (item) => item.text === 'productivity',
    );
    expect(productivity?.strategy).toBe('search');
    expect(productivity?.priority).toBe(6000);
    expect(suggestions.some((item) => item.text === 'habit')).toBe(false);
  });

  it('suggests common terms from similar apps with usedByCount', async () => {
    const id = await importApp();

    const response = await api
      .get(`/apps/${id}/keywords/suggestions`)
      .query({ strategy: 'similar' })
      .expect(200);
    const suggestions = response.body as KeywordSuggestion[];

    const planner = suggestions.find((item) => item.text === 'planner');
    expect(planner?.strategy).toBe('similar');
    expect(planner?.usedByCount).toBe(2);
  });

  it('suggests common terms from the developer catalogue', async () => {
    const id = await importApp();

    const response = await api
      .get(`/apps/${id}/keywords/suggestions`)
      .query({ strategy: 'developer' })
      .expect(200);
    const suggestions = response.body as KeywordSuggestion[];

    const timer = suggestions.find((item) => item.text === 'timer');
    expect(timer?.strategy).toBe('developer');
    expect(timer?.usedByCount).toBe(2);
  });

  it('mines ranked untracked phrases from stored reviews', async () => {
    const id = await importApp();
    await prisma.review.createMany({
      data: [
        { appId: id, reviewId: 'rv1', score: 5, text: 'dark mode is great' },
        { appId: id, reviewId: 'rv2', score: 4, text: 'please add dark mode' },
        { appId: id, reviewId: 'rv3', score: 3, text: 'love the widget' },
      ],
    });

    const response = await api
      .get(`/apps/${id}/keywords/suggestions`)
      .query({ strategy: 'reviews' })
      .expect(200);
    const suggestions = response.body as KeywordSuggestion[];

    const darkMode = suggestions.find((item) => item.text === 'dark mode');
    expect(darkMode?.strategy).toBe('reviews');
    expect(darkMode?.usedByCount).toBe(2);
  });

  it('enqueues spider probes and aggregates them progressively', async () => {
    const id = await importApp();
    const spider = app.get(SpiderService);

    const started = await api
      .post(`/apps/${id}/keywords/spider`)
      .send({ term: 'Habit Tracker' })
      .expect(202);
    expect((started.body as SpiderEnqueueResult).enqueued).toBe(27);

    const empty = await api
      .get(`/apps/${id}/keywords/spider`)
      .query({ term: 'habit tracker' })
      .expect(200);
    const emptyStatus = empty.body as SpiderStatus;
    expect(emptyStatus.probesTotal).toBe(27);
    expect(emptyStatus.probesDone).toBe(0);
    expect(emptyStatus.complete).toBe(false);

    await asWorkspace(app, () =>
      spider.runSpiderProbe({
        appId: id,
        term: 'habit tracker',
        country: 'us',
        probe: '',
        workspaceId: DEFAULT_WORKSPACE_ID,
      }),
    );

    const afterOne = await api
      .get(`/apps/${id}/keywords/spider`)
      .query({ term: 'habit tracker' })
      .expect(200);
    const oneStatus = afterOne.body as SpiderStatus;
    expect(oneStatus.probesDone).toBe(1);
    const productivity = oneStatus.suggestions.find(
      (item) => item.text === 'productivity',
    );
    expect(productivity?.probes).toBe(1);
    expect(oneStatus.suggestions.some((item) => item.text === 'habit')).toBe(
      false,
    );

    await asWorkspace(app, () =>
      spider.runSpiderProbe({
        appId: id,
        term: 'habit tracker',
        country: 'us',
        probe: 'a',
        workspaceId: DEFAULT_WORKSPACE_ID,
      }),
    );

    const afterTwo = await api
      .get(`/apps/${id}/keywords/spider`)
      .query({ term: 'habit tracker' })
      .expect(200);
    const twoStatus = afterTwo.body as SpiderStatus;
    expect(twoStatus.probesDone).toBe(2);
    expect(
      twoStatus.suggestions.find((item) => item.text === 'productivity')
        ?.probes,
    ).toBe(2);

    const reStarted = await api
      .post(`/apps/${id}/keywords/spider`)
      .send({ term: 'habit tracker' })
      .expect(202);
    expect((reStarted.body as SpiderEnqueueResult).enqueued).toBe(25);
  });

  it('runs the same term in two markets as two independent deep searches', async () => {
    const id = await importApp();
    const spider = app.get(SpiderService);

    await api
      .post(`/apps/${id}/keywords/spider`)
      .send({ term: 'habit tracker', country: 'de' })
      .expect(202);

    await asWorkspace(app, () =>
      spider.runSpiderProbe({
        appId: id,
        term: 'habit tracker',
        country: 'de',
        probe: '',
        workspaceId: DEFAULT_WORKSPACE_ID,
      }),
    );

    const german = await api
      .get(`/apps/${id}/keywords/spider`)
      .query({ term: 'habit tracker', country: 'de' })
      .expect(200);
    expect((german.body as SpiderStatus).probesDone).toBe(1);

    const home = await api
      .get(`/apps/${id}/keywords/spider`)
      .query({ term: 'habit tracker' })
      .expect(200);
    expect((home.body as SpiderStatus).probesDone).toBe(0);

    const restartHome = await api
      .post(`/apps/${id}/keywords/spider`)
      .send({ term: 'habit tracker' })
      .expect(202);
    expect((restartHome.body as SpiderEnqueueResult).enqueued).toBe(27);
  });

  it('probes the storefront the deep search asked for', async () => {
    const id = await importApp();
    const spider = app.get(SpiderService);
    registry.suggestCalls = [];

    await asWorkspace(app, () =>
      spider.runSpiderProbe({
        appId: id,
        term: 'habit tracker',
        country: 'de',
        probe: '',
        workspaceId: DEFAULT_WORKSPACE_ID,
      }),
    );

    expect(registry.suggestCalls).toEqual([
      { term: 'habit tracker', country: 'de' },
    ]);
  });

  it('falls back to the home market for a probe queued before markets existed', async () => {
    const id = await importApp();
    const spider = app.get(SpiderService);
    registry.suggestCalls = [];

    await asWorkspace(app, () =>
      spider.runSpiderProbe({
        appId: id,
        term: 'habit tracker',
        probe: '',
        workspaceId: DEFAULT_WORKSPACE_ID,
      }),
    );

    expect(registry.suggestCalls).toEqual([
      { term: 'habit tracker', country: 'us' },
    ]);
    const stored = await prisma.suggestProbe.findFirst({
      where: { appId: id, term: 'habit tracker' },
    });
    expect(stored?.country).toBe('us');
  });

  it('rejects a spider term shorter than two characters', async () => {
    const id = await importApp();

    await api
      .post(`/apps/${id}/keywords/spider`)
      .send({ term: 'a' })
      .expect(400);
  });

  it('checks a tracked google play keyword and writes ranking and serp rows', async () => {
    const you = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.GOOGLE_PLAY,
        storeAppId: 'com.example.game',
        country: 'us',
        name: 'Idle Tower Defense',
      },
    });
    const keyword = await prisma.keyword.create({
      data: { text: 'tower defense', store: Store.GOOGLE_PLAY, country: 'us' },
    });
    await prisma.trackedKeyword.create({
      data: {
        appId: you.id,
        keywordId: keyword.id,
        source: 'MANUAL',
        active: true,
      },
    });

    await asWorkspace(app, () =>
      app.get(RankingsService).checkKeyword(keyword.id),
    );

    const ranking = await prisma.keywordRanking.findFirst({
      where: { appId: you.id, keywordId: keyword.id },
    });
    expect(ranking?.position).toBe(1);
    expect(ranking?.depth).toBe(200);

    const tracked = await api.get(`/apps/${you.id}/keywords`).expect(200);
    expect((tracked.body as TrackedKeywordItem[])[0].latestDepth).toBe(200);

    const serp = await prisma.serpEntry.findMany({
      where: { keywordId: keyword.id },
      orderBy: { position: 'asc' },
    });
    expect(serp).toHaveLength(2);
    expect(serp[0].storeAppId).toBe('com.example.game');
    expect(serp[0].ratingCount).toBeNull();
  });

  it('rejects empty and overly long keyword phrases', async () => {
    const id = await importApp();

    await api
      .post(`/apps/${id}/keywords`)
      .send({ keywords: ['   '] })
      .expect(400);

    await api
      .post(`/apps/${id}/keywords`)
      .send({ keywords: ['one two three four five six'] })
      .expect(400);
  });
});
