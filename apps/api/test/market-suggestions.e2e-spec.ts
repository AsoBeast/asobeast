import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import {
  MarketSuggestion,
  MarketSuggestionsResult,
  nativeLocalizations,
} from '@asobeast/shared';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { LocalizedRegistry } from './helpers/localized-store';
import { ownerAgent, useCookies } from './helpers/session';
import { testDb } from './helpers/test-db';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

describe('Market suggestions (e2e)', () => {
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
    })
      .overrideProvider(StoreProviderRegistry)
      .useValue(new LocalizedRegistry())
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
      'TRUNCATE TABLE "App", "Keyword", "AppGroup" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const createApp = (store: Store = Store.APP_STORE, primaryAppId?: string) =>
    prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store,
        storeAppId: primaryAppId ? '555000999' : '555000111',
        country: 'us',
        name: primaryAppId ? 'Rival' : 'Suggest Fixture',
        isCompetitor: primaryAppId !== undefined,
        primaryAppId,
      },
    });

  const snapshot = (appId: string, languages: string[], capturedAt?: Date) =>
    prisma.appSnapshot.create({
      data: {
        appId,
        title: 'Seeded Title',
        description: 'Seeded text',
        raw: { languages },
        ...(capturedAt ? { capturedAt } : {}),
      },
    });

  const seedApp = async (languages: string[], competitors = 0) => {
    const created = await createApp();
    await snapshot(created.id, languages);
    for (let index = 0; index < competitors; index += 1) {
      await createApp(Store.APP_STORE, created.id);
    }
    return created.id;
  };

  const trackIn = async (appId: string, country: string, text: string) => {
    const keyword = await prisma.keyword.create({
      data: { text, store: Store.APP_STORE, country },
    });
    await prisma.trackedKeyword.create({
      data: { appId, keywordId: keyword.id, source: 'MANUAL', active: true },
    });
  };

  const suggest = async (appId: string) =>
    (await api.get(`/apps/${appId}/market-suggestions`).expect(200))
      .body as MarketSuggestionsResult;

  const find = (result: MarketSuggestionsResult, country: string) =>
    result.suggestions.find((entry) => entry.country === country);

  it('suggests the storefronts that read a declared language, the home market left out', async () => {
    const appId = await seedApp(['EN', 'DE', 'FR', 'JA']);

    const result = await suggest(appId);

    expect(result.home).toBe('us');
    expect(result.languages).toEqual(['en', 'de', 'fr', 'ja']);
    const countries = result.suggestions.map((entry) => entry.country);
    expect(countries).toEqual(
      expect.arrayContaining(['de', 'at', 'ch', 'fr', 'jp', 'ca']),
    );
    expect(countries).not.toContain('us');
    expect(countries.filter((country) => country === 'ch')).toHaveLength(1);
    expect(find(result, 'ch')).toMatchObject({
      localization: 'de',
      role: 'default',
    });
    expect(find(result, 'ca')).toMatchObject({
      localization: 'fr-CA',
      role: 'additional',
    });
  });

  it('marks a market the app already tracks', async () => {
    const appId = await seedApp(['EN', 'DE', 'FR']);
    await trackIn(appId, 'de', 'gewohnheit');

    const result = await suggest(appId);

    expect(find(result, 'de')?.tracked).toBe(true);
    expect(find(result, 'fr')?.tracked).toBe(false);
  });

  it('prices a market by the family size and the keyword weight', async () => {
    const appId = await seedApp(['EN', 'DE', 'PL'], 1);

    const result = await suggest(appId);

    expect(find(result, 'de')?.dailyRequests).toEqual({
      listing: 2,
      perKeyword: 1,
    } satisfies MarketSuggestion['dailyRequests']);
    expect(find(result, 'pl')?.dailyRequests).toEqual({
      listing: 2 + nativeLocalizations('pl').length * 2,
      perKeyword: 1,
    });
  });

  it('prices the shipped localizations a market captures beside its default', async () => {
    const appId = await seedApp(['EN', 'DE', 'FR']);
    await prisma.appLocalization.create({
      data: {
        appId,
        workspaceId: DEFAULT_WORKSPACE_ID,
        localization: 'fr',
        origin: 'manual',
      },
    });

    const result = await suggest(appId);

    expect(find(result, 'ch')?.dailyRequests).toEqual({
      listing: 2,
      perKeyword: 1,
    });
    expect(find(result, 'de')?.dailyRequests).toEqual({
      listing: 1,
      perKeyword: 1,
    });
  });

  it('answers nothing for a google play app', async () => {
    const play = await createApp(Store.GOOGLE_PLAY);
    await snapshot(play.id, ['EN', 'DE']);

    await expect(suggest(play.id)).resolves.toEqual({
      home: 'us',
      languages: [],
      suggestions: [],
    } satisfies MarketSuggestionsResult);
  });

  it('reads the newest home listing', async () => {
    const created = await createApp();
    await snapshot(created.id, ['EN', 'DE'], new Date('2026-01-01T00:00:00Z'));
    await snapshot(created.id, ['EN', 'IT'], new Date('2026-02-01T00:00:00Z'));

    const result = await suggest(created.id);

    expect(result.languages).toEqual(['en', 'it']);
    expect(find(result, 'it')).toMatchObject({ role: 'default' });
    expect(find(result, 'de')).toBeUndefined();
  });

  it("ignores norwegian's lookup code", async () => {
    const appId = await seedApp(['NB']);

    const result = await suggest(appId);

    expect(result.languages).toEqual(['no']);
    expect(result.suggestions).toEqual([
      expect.objectContaining({
        country: 'no',
        localization: 'no',
        role: 'additional',
      }),
    ]);
  });

  it('answers 404 for an unknown app', async () => {
    await api.get('/apps/no-such-app/market-suggestions').expect(404);
  });
});
