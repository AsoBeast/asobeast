import { execSync } from 'child_process';
import { join } from 'path';
import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import {
  ApiErrorEnvelope,
  AppDetail,
  DailyBudget,
  KEYWORD_FIELD_BYTE_LIMIT,
  KEYWORD_FIELD_CHAR_LIMIT,
  KeywordFieldResult,
  KeywordSuggestion,
  SpiderEnqueueResult,
  SUGGEST_REACH_STATUSES,
  SpiderStatus,
  utf8ByteLength,
  TrackedKeywordItem,
} from '@asobeast/shared';
import { Queue } from 'bullmq';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { QUEUES } from '../src/jobs/jobs.types';
import { asWorkspace } from './helpers/tenancy';
import { testDb } from './helpers/test-db';
import { ownerAgent, useCookies } from './helpers/session';
import { obliterateQueues, pauseQueues } from './obliterate-queues';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { SpiderService } from '../src/keywords/spider.service';
import { RankingsService } from '../src/rankings/rankings.service';
import { ScoringService } from '../src/scoring/scoring.service';
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
  searchable: true,
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
    for (const item of added.body as TrackedKeywordItem[]) {
      expect(item.tags).toEqual([]);
      expect(item.note).toBeNull();
    }

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

  it('adds no keyword searches to the budget when a competitor is refreshed', async () => {
    const id = await importApp();
    const before = (await api.get('/jobs/budget').expect(200))
      .body as DailyBudget;

    const competitor = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '9876543210',
        country: 'us',
        name: 'Rival',
        isCompetitor: true,
        primaryAppId: id,
      },
    });
    await api.post(`/apps/${competitor.id}/refresh`).expect(200);

    const after = (await api.get('/jobs/budget').expect(200))
      .body as DailyBudget;
    expect(after.keywords).toBe(before.keywords);
    expect(
      await prisma.trackedKeyword.count({ where: { appId: competitor.id } }),
    ).toBe(0);
  });

  it('refuses a bulk add larger than one request may carry', async () => {
    const id = await importApp();

    await api
      .post(`/apps/${id}/keywords`)
      .send({
        keywords: Array.from({ length: 5_000 }, (_, index) => `kw${index}`),
      })
      .expect(400);

    const items = (await api.get(`/apps/${id}/keywords`).expect(200))
      .body as TrackedKeywordItem[];
    expect(items.some((item) => item.text.startsWith('kw'))).toBe(false);
  });

  it('refuses a keyword phrase longer than a store search box accepts', async () => {
    const id = await importApp();

    await api
      .post(`/apps/${id}/keywords`)
      .send({ keywords: ['b'.repeat(10_000)] })
      .expect(400);

    expect(
      await prisma.keyword.count({ where: { text: 'b'.repeat(10_000) } }),
    ).toBe(0);
  });

  it('refuses a keyword field longer than the endpoint accepts', async () => {
    const id = await importApp();

    await api
      .put(`/apps/${id}/keyword-field`)
      .send({
        text: Array.from({ length: 5_000 }, (_, index) => `kw${index}`).join(
          ',',
        ),
      })
      .expect(400);

    expect(
      await prisma.trackedKeyword.count({ where: { source: 'KEYWORD_FIELD' } }),
    ).toBe(0);
  });

  it('refuses a keyword field phrase no store search box would accept', async () => {
    const id = await importApp();

    await api
      .put(`/apps/${id}/keyword-field`)
      .send({ text: `habit,${'b'.repeat(500)}` })
      .expect(400);

    expect(
      await prisma.trackedKeyword.count({ where: { source: 'KEYWORD_FIELD' } }),
    ).toBe(0);
  });

  it('refuses a keyword field one character over the limit and keeps the stored one', async () => {
    const id = await importApp();
    await api
      .put(`/apps/${id}/keyword-field`)
      .send({ text: 'habit' })
      .expect(200);
    const text = Array.from(
      { length: 17 },
      (_, index) => `kw${String(index).padStart(3, '0')}`,
    ).join(',');
    expect(text).toHaveLength(KEYWORD_FIELD_CHAR_LIMIT + 1);

    const response = await api
      .put(`/apps/${id}/keyword-field`)
      .send({ text })
      .expect(400);

    expect((response.body as ApiErrorEnvelope).message).toBe(
      `Keyword field exceeds ${KEYWORD_FIELD_BYTE_LIMIT} bytes`,
    );
    const stored = await api.get(`/apps/${id}/keyword-field`).expect(200);
    expect(
      (stored.body as KeywordFieldResult).tracked.map((item) => item.text),
    ).toEqual(['habit']);
    expect(
      await prisma.keyword.count({ where: { text: { startsWith: 'kw' } } }),
    ).toBe(0);
  });

  it('refuses a keyword field that fits 100 characters but not 100 bytes', async () => {
    const id = await importApp();
    const text =
      'zażółć,gęślą,jaźń,łódź,źrebię,ćma,żółw,świeca,mąka,ślimak,pączek,żaba,źdźbło,ćwierć';
    expect(text).toHaveLength(83);
    expect(utf8ByteLength(text)).toBe(111);

    const response = await api
      .put(`/apps/${id}/keyword-field`)
      .send({ text })
      .expect(400);

    expect((response.body as ApiErrorEnvelope).message).toBe(
      `Keyword field exceeds ${KEYWORD_FIELD_BYTE_LIMIT} bytes`,
    );
  });

  it('holds a multibyte keyword field to exactly 100 bytes', async () => {
    const id = await importApp();

    const atLimit = await api
      .put(`/apps/${id}/keyword-field`)
      .send({ text: 'ą'.repeat(50) })
      .expect(200);
    expect((atLimit.body as KeywordFieldResult).charactersUsed).toBe(
      KEYWORD_FIELD_BYTE_LIMIT,
    );

    await api
      .put(`/apps/${id}/keyword-field`)
      .send({ text: `${'a'.repeat(99)}ą` })
      .expect(400);
  });

  it('counts a stored multibyte keyword field in bytes', async () => {
    const id = await importApp();

    const response = await api
      .put(`/apps/${id}/keyword-field`)
      .send({ text: 'zażółć,łódź' })
      .expect(200);
    const body = response.body as KeywordFieldResult;

    expect(body.charactersUsed).toBe(18);
    expect(body.charactersLimit).toBe(KEYWORD_FIELD_BYTE_LIMIT);
  });

  it('stores a decomposed keyword field in its precomposed form', async () => {
    const id = await importApp();
    const text = 'zażółć,łódź';
    expect(text.normalize('NFD')).not.toBe(text);

    const response = await api
      .put(`/apps/${id}/keyword-field`)
      .send({ text: text.normalize('NFD') })
      .expect(200);
    const body = response.body as KeywordFieldResult;

    expect(body.tracked.map((item) => item.text).sort()).toEqual([
      'zażółć',
      'łódź',
    ]);
    expect(body.charactersUsed).toBe(18);
    expect(
      await prisma.keyword.count({
        where: { text: { in: ['zażółć', 'łódź'] } },
      }),
    ).toBe(2);
  });

  it('accepts a keyword field at the limit once spacing, casing and duplicates are removed', async () => {
    const id = await importApp();
    const phrases = [
      'kw00',
      ...Array.from(
        { length: 16 },
        (_, index) => `kw${String(index + 1).padStart(3, '0')}`,
      ),
    ];
    expect(phrases.join(',')).toHaveLength(KEYWORD_FIELD_CHAR_LIMIT);

    const response = await api
      .put(`/apps/${id}/keyword-field`)
      .send({ text: ` ${phrases.join(' , ').toUpperCase()} ,kw001` })
      .expect(200);
    const body = response.body as KeywordFieldResult;

    expect(body.charactersUsed).toBe(KEYWORD_FIELD_CHAR_LIMIT);
    expect(body.duplicatesRemoved).toBe(1);
    expect(body.tracked.map((item) => item.text).sort()).toEqual(
      [...phrases].sort(),
    );
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

    const dropped = await prisma.trackedKeyword.findMany({
      where: { appId: id, keyword: { text: { in: ['streak', 'tracker'] } } },
      orderBy: { keyword: { text: 'asc' } },
      select: {
        source: true,
        active: true,
        fieldOrder: true,
        keyword: { select: { text: true } },
      },
    });
    expect(dropped).toEqual([
      {
        source: 'SUBTITLE',
        active: true,
        fieldOrder: null,
        keyword: { text: 'streak' },
      },
      {
        source: 'TITLE',
        active: true,
        fieldOrder: null,
        keyword: { text: 'tracker' },
      },
    ]);
  });

  const putKeywordField = (id: string, text: string) =>
    api.put(`/apps/${id}/keyword-field`).send({ text }).expect(200);

  const trackedItem = async (id: string, text: string) =>
    (
      (await api.get(`/apps/${id}/keywords`).expect(200))
        .body as TrackedKeywordItem[]
    ).find((item) => item.text === text);

  const fieldTexts = async (id: string) =>
    (
      (await api.get(`/apps/${id}/keyword-field`).expect(200))
        .body as KeywordFieldResult
    ).tracked.map((item) => item.text);

  it('keeps a title keyword tracked after a keyword field save leaves it out', async () => {
    const id = await importApp();
    await putKeywordField(id, 'habit,goals');
    expect(await trackedItem(id, 'habit')).toMatchObject({
      active: true,
      source: 'KEYWORD_FIELD',
    });

    await putKeywordField(id, 'goals');

    expect(await fieldTexts(id)).toEqual(['goals']);
    expect(await trackedItem(id, 'habit')).toMatchObject({
      active: true,
      source: 'TITLE',
    });
  });

  it('keeps a phrase added manually after the keyword field dropped it', async () => {
    const id = await importApp();
    await putKeywordField(id, 'goals,focus');
    await putKeywordField(id, 'focus');

    await api
      .post(`/apps/${id}/keywords`)
      .send({ keywords: ['goals'] })
      .expect(201);

    expect(await fieldTexts(id)).toEqual(['focus']);
    await putKeywordField(id, 'deep work');
    expect(await trackedItem(id, 'goals')).toMatchObject({
      active: true,
      source: 'MANUAL',
    });
  });

  it('keeps a dropped phrase reactivated by hand out of the keyword field', async () => {
    const id = await importApp();
    await putKeywordField(id, 'goals,focus');
    await putKeywordField(id, 'focus');
    const goals = await trackedItem(id, 'goals');

    await api
      .patch(`/apps/${id}/keywords/${goals?.keywordId}`)
      .send({ active: true })
      .expect(200);

    expect(await fieldTexts(id)).toEqual(['focus']);
    await putKeywordField(id, 'deep work');
    expect(await trackedItem(id, 'goals')).toMatchObject({
      active: true,
      source: 'MANUAL',
    });
  });

  it('keeps a keyword field phrase tracked once a refreshed title contains it', async () => {
    const id = await importApp();
    await prisma.trackedKeyword.deleteMany({
      where: { appId: id, keyword: { text: 'habit' } },
    });
    await putKeywordField(id, 'habit,goals');

    await api.post(`/apps/${id}/refresh`).expect(200);
    await putKeywordField(id, 'goals');

    expect(await trackedItem(id, 'habit')).toMatchObject({
      active: true,
      source: 'TITLE',
    });
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

  describe('a market that is not a storefront of the app store', () => {
    const playApp = () =>
      prisma.app.create({
        data: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          store: Store.GOOGLE_PLAY,
          storeAppId: 'com.example.game',
          country: 'us',
          name: 'Idle Tower Defense',
        },
      });

    const storeQueue = () =>
      app.get<Queue>(getQueueToken(QUEUES.APP_STORE), { strict: false });

    it.each([
      ['zz', 'zz is not an App Store storefront'],
      ['ad', 'ad is not an App Store storefront'],
    ])(
      'refuses to track an app store keyword in %j',
      async (country, message) => {
        const id = await importApp();

        const response = await api
          .post(`/apps/${id}/keywords`)
          .send({ keywords: ['habit'], country })
          .expect(400);

        expect((response.body as ApiErrorEnvelope).message).toBe(message);
        expect(await prisma.keyword.count({ where: { country } })).toBe(0);
      },
    );

    it('refuses to track a google play keyword in an app store only storefront', async () => {
      const play = await playApp();

      const response = await api
        .post(`/apps/${play.id}/keywords`)
        .send({ keywords: ['tower defense'], country: 'pw' })
        .expect(400);

      expect((response.body as ApiErrorEnvelope).message).toBe(
        'pw is not a Google Play location',
      );
      expect(await prisma.keyword.count({ where: { country: 'pw' } })).toBe(0);
    });

    it.each(['pw', 'xk'])(
      'tracks an app store keyword in the storefront %j',
      async (country) => {
        const id = await importApp();

        await api
          .post(`/apps/${id}/keywords`)
          .send({ keywords: ['habit'], country })
          .expect(201);

        expect(await prisma.keyword.count({ where: { country } })).toBe(1);
      },
    );

    it('tracks a google play keyword in a location the app store does not have', async () => {
      const play = await playApp();

      await api
        .post(`/apps/${play.id}/keywords`)
        .send({ keywords: ['tower defense'], country: 'ad' })
        .expect(201);

      const tracked = await prisma.trackedKeyword.findMany({
        where: { appId: play.id, keyword: { country: 'ad' } },
        select: { active: true, keyword: { select: { store: true } } },
      });
      expect(tracked).toEqual([
        { active: true, keyword: { store: Store.GOOGLE_PLAY } },
      ]);
    });

    it('starts no deep search in a market that is not a storefront', async () => {
      const id = await importApp();
      const before = await storeQueue().count();

      await api
        .post(`/apps/${id}/keywords/spider`)
        .send({ term: 'habit tracker', country: 'zz' })
        .expect(400);

      expect(await storeQueue().count()).toBe(before);
    });

    it.each(['zz', 'ad'])(
      'discards a queued app store deep search probe for the market %j',
      async (country) => {
        const id = await importApp();
        const spider = app.get(SpiderService);
        registry.suggestCalls = [];

        await asWorkspace(app, () =>
          spider.runSpiderProbe({
            appId: id,
            term: 'habit tracker',
            country,
            probe: '',
            workspaceId: DEFAULT_WORKSPACE_ID,
          }),
        );

        expect(registry.suggestCalls).toEqual([]);
        expect(await prisma.suggestProbe.count({ where: { country } })).toBe(0);
      },
    );

    it('suggests nothing from the store for a market that is not a storefront', async () => {
      const id = await importApp();
      registry.suggestCalls = [];

      await api
        .get(`/apps/${id}/keywords/suggestions`)
        .query({ strategy: 'search', country: 'zz' })
        .expect(400);

      expect(registry.suggestCalls).toEqual([]);
    });

    it('refuses to reactivate a keyword tracked in a market that is not a storefront', async () => {
      const id = await importApp();
      const keyword = await prisma.keyword.create({
        data: { text: 'habit', store: Store.APP_STORE, country: 'zz' },
      });
      await prisma.trackedKeyword.create({
        data: {
          appId: id,
          keywordId: keyword.id,
          source: 'MANUAL',
          active: false,
        },
      });

      await api
        .patch(`/apps/${id}/keywords/${keyword.id}`)
        .send({ active: true })
        .expect(400);

      const tracked = await prisma.trackedKeyword.findUniqueOrThrow({
        where: { appId_keywordId: { appId: id, keywordId: keyword.id } },
      });
      expect(tracked.active).toBe(false);
    });

    it('still deactivates a keyword tracked in a market that is not a storefront', async () => {
      const id = await importApp();
      const keyword = await prisma.keyword.create({
        data: { text: 'habit', store: Store.APP_STORE, country: 'zz' },
      });
      await prisma.trackedKeyword.create({
        data: {
          appId: id,
          keywordId: keyword.id,
          source: 'MANUAL',
          active: true,
        },
      });

      await api
        .patch(`/apps/${id}/keywords/${keyword.id}`)
        .send({ active: false })
        .expect(200);

      const tracked = await prisma.trackedKeyword.findUniqueOrThrow({
        where: { appId_keywordId: { appId: id, keywordId: keyword.id } },
      });
      expect(tracked.active).toBe(false);
    });
  });

  it('returns score signals and the outdated flag next to every v1 field', async () => {
    const id = await importApp();
    const before = (await api.get(`/apps/${id}/keywords`).expect(200))
      .body as TrackedKeywordItem[];
    const current = before.find((item) => item.text === 'habit');
    const outdated = before.find((item) => item.text === 'tracker');
    expect(current && outdated).toBeTruthy();

    await asWorkspace(app, () =>
      app.get(ScoringService).scoreKeyword(current?.keywordId ?? ''),
    );
    await prisma.keywordMetric.create({
      data: {
        keywordId: outdated?.keywordId ?? '',
        date: new Date('2026-07-01'),
        traffic: 5,
        difficulty: 4,
        stats: {},
        scoringSource: 'APPLE_SUGGEST_SEARCH',
        formulaVersion: 'app-store-v1',
        confidence: 'HIGH',
        capturedAt: new Date('2026-07-01T09:30:00.000Z'),
      },
    });

    const items = (await api.get(`/apps/${id}/keywords`).expect(200))
      .body as TrackedKeywordItem[];
    const scored = items.find((item) => item.text === 'habit');
    const old = items.find((item) => item.text === 'tracker');

    expect(SUGGEST_REACH_STATUSES).toContain(
      scored?.scoreSignals?.suggestReach,
    );
    expect(scored?.scoreOutdated).toBe(false);
    expect(old?.scoreSignals).toBeNull();
    expect(old?.scoreOutdated).toBe(true);
    expect(old).toMatchObject({
      keywordId: expect.any(String) as string,
      text: 'tracker',
      country: 'us',
      source: expect.any(String) as string,
      active: true,
      latestPosition: null,
      latestDepth: null,
      previousPosition: null,
      positionDelta1d: null,
      positionDelta7d: null,
      traffic: 5,
      difficulty: 4,
      volume: 50,
      relevance: expect.any(Number) as number,
      opportunity: expect.any(Number) as number,
      bucket: expect.any(String) as string,
      scoredAt: '2026-07-01',
      scoreProvenance: {
        source: 'APPLE_SUGGEST_SEARCH',
        formulaVersion: 'app-store-v1',
        capturedAt: '2026-07-01T09:30:00.000Z',
        confidence: 'HIGH',
      },
      serpVolatility7d: null,
    });
  });
  describe('tags and notes', () => {
    const tracked = async (): Promise<{ id: string; keywordId: string }> => {
      const id = await importApp();
      const added = await api
        .post(`/apps/${id}/keywords`)
        .send({ keywords: ['streak counter'] })
        .expect(201);
      const [item] = added.body as TrackedKeywordItem[];
      return { id, keywordId: item.keywordId };
    };

    const listed = async (id: string, keywordId: string) =>
      (
        (await api.get(`/apps/${id}/keywords`).expect(200))
          .body as TrackedKeywordItem[]
      ).find((item) => item.keywordId === keywordId);

    it('stores normalized tags and lists them', async () => {
      const { id, keywordId } = await tracked();

      const patched = await api
        .patch(`/apps/${id}/keywords/${keywordId}`)
        .send({ tags: ['Core', ' brand '] })
        .expect(200);

      expect((patched.body as TrackedKeywordItem).tags).toEqual([
        'core',
        'brand',
      ]);
      expect((await listed(id, keywordId))?.tags).toEqual(['core', 'brand']);
    });

    it('clears tags and repeats a list idempotently', async () => {
      const { id, keywordId } = await tracked();
      const path = `/apps/${id}/keywords/${keywordId}`;

      await api
        .patch(path)
        .send({ tags: ['core'] })
        .expect(200);
      const again = await api
        .patch(path)
        .send({ tags: ['core'] })
        .expect(200);
      expect((again.body as TrackedKeywordItem).tags).toEqual(['core']);

      const cleared = await api.patch(path).send({ tags: [] }).expect(200);
      expect((cleared.body as TrackedKeywordItem).tags).toEqual([]);
    });

    it('trims a note and stores a blank or null note as none', async () => {
      const { id, keywordId } = await tracked();
      const path = `/apps/${id}/keywords/${keywordId}`;

      const noted = await api
        .patch(path)
        .send({ note: '  seasonal  ' })
        .expect(200);
      expect((noted.body as TrackedKeywordItem).note).toBe('seasonal');

      for (const note of ['', null]) {
        const cleared = await api.patch(path).send({ note }).expect(200);
        expect((cleared.body as TrackedKeywordItem).note).toBeNull();
      }
    });

    it('applies active and tags from one request', async () => {
      const { id, keywordId } = await tracked();

      const patched = await api
        .patch(`/apps/${id}/keywords/${keywordId}`)
        .send({ active: false, tags: ['core'] })
        .expect(200);

      expect(patched.body as TrackedKeywordItem).toMatchObject({
        active: false,
        tags: ['core'],
      });
    });

    it('refuses nine tags and keeps the stored list', async () => {
      const { id, keywordId } = await tracked();
      const path = `/apps/${id}/keywords/${keywordId}`;
      await api
        .patch(path)
        .send({ tags: ['core'] })
        .expect(200);

      await api
        .patch(path)
        .send({ tags: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'] })
        .expect(400);

      expect((await listed(id, keywordId))?.tags).toEqual(['core']);
    });

    it.each([{ tags: null }, { tags: ['ok', 7] }, { tags: ['#hash'] }])(
      'refuses %j with the standard envelope',
      async (body) => {
        const { id, keywordId } = await tracked();

        const response = await api
          .patch(`/apps/${id}/keywords/${keywordId}`)
          .send(body)
          .expect(400);

        expect((response.body as ApiErrorEnvelope).statusCode).toBe(400);
      },
    );

    it('refuses a note over the limit', async () => {
      const { id, keywordId } = await tracked();

      await api
        .patch(`/apps/${id}/keywords/${keywordId}`)
        .send({ note: 'x'.repeat(501) })
        .expect(400);
    });

    it('answers 404 for a keyword the app does not track', async () => {
      const id = await importApp();

      await api
        .patch(`/apps/${id}/keywords/missing`)
        .send({ tags: ['core'] })
        .expect(404);
    });
  });
});
