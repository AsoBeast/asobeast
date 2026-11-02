import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import { CompetitorSuggestions } from '@asobeast/shared';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { addDays, utcToday } from '../src/analytics/analytics.support';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { StoreRequestError } from '../src/store-providers/errors';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import type {
  NormalizedApp,
  SearchItem,
  StoreProvider,
} from '../src/store-providers/types';
import { ownerAgent, useCookies } from './helpers/session';
import { testDb } from './helpers/test-db';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

const PRIMARY_ID = '111000111';
const SIMILAR_ICON = 'https://is1-ssl.mzstatic.com/image/thumb/s/512x512bb.jpg';
const rankedIcon = (storeAppId: string) =>
  `https://is1-ssl.mzstatic.com/image/thumb/${storeAppId}/512x512bb.jpg`;
const D1 = addDays(utcToday(), -1);
const D2 = addDays(utcToday(), -2);

const SIMILAR: SearchItem[] = [
  { storeAppId: PRIMARY_ID, title: 'Self' },
  {
    storeAppId: '444000444',
    title: 'Deep Focus Pro',
    developer: 'Deep Co',
    iconUrl: SIMILAR_ICON,
  },
  { storeAppId: '555000555', title: 'Study Bunny' },
];

const PLAY_PRIMARY_ID = 'com.lingo.app';
const PLAY_SIMILAR: SearchItem[] = [
  {
    storeAppId: 'com.video.app',
    title: 'Video Tube',
    summary: 'Watch videos and listen to music every day.',
  },
  {
    storeAppId: 'com.pins.app',
    title: 'Pin Board',
    summary: 'Discover recipes, home ideas and style inspiration.',
  },
  {
    storeAppId: 'com.speak.app',
    title: 'Speak Easy',
    summary: 'Practice Spanish conversation with friendly tutors.',
  },
  {
    storeAppId: 'com.words.app',
    title: 'Word Lab: Language Lessons',
    summary:
      'Learn Spanish, French and English with fun lessons from native speakers.',
  },
];

class SuggestionsRegistry {
  similarCalls: [string, string][] = [];
  failure: Error | null = null;

  get(store: Store): StoreProvider {
    return {
      store,
      getApp: (storeAppId: string): Promise<NormalizedApp> =>
        Promise.resolve({
          store,
          storeAppId,
          title: `Captured ${storeAppId}`,
          description: 'Fixture',
          raw: {},
          searchable: true,
        }),
      similar: (storeAppId: string, country: string) => {
        this.similarCalls.push([storeAppId, country]);
        return this.failure
          ? Promise.reject(this.failure)
          : Promise.resolve(
              store === Store.GOOGLE_PLAY ? PLAY_SIMILAR : SIMILAR,
            );
      },
    } as unknown as StoreProvider;
  }
}

describe('Competitor suggestions (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;
  const registry = new SuggestionsRegistry();

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
    registry.similarCalls = [];
    registry.failure = null;
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const createPrimary = (country = 'de') =>
    prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: PRIMARY_ID,
        country,
        name: 'Focus',
      },
    });

  const seedSerp = async (
    appId: string,
    entries: {
      storeAppId: string;
      position: number;
      date: Date;
      title?: string;
      iconUrl?: string | null;
    }[],
    market = 'de',
  ) => {
    const keyword = await prisma.keyword.create({
      data: { text: 'focus timer', store: Store.APP_STORE, country: market },
    });
    await prisma.trackedKeyword.create({
      data: { appId, keywordId: keyword.id, source: 'MANUAL', active: true },
    });
    await prisma.serpEntry.createMany({
      data: entries.map((entry) => ({
        keywordId: keyword.id,
        date: entry.date,
        position: entry.position,
        storeAppId: entry.storeAppId,
        title: entry.title ?? `Ranked ${entry.storeAppId}`,
        developer: 'Ranked Co',
        iconUrl:
          entry.iconUrl === undefined
            ? rankedIcon(entry.storeAppId)
            : entry.iconUrl,
      })),
    });
  };

  const suggest = (appId: string) =>
    api.get(`/apps/${appId}/competitors/suggestions`);

  const serpItem = (body: CompetitorSuggestions, storeAppId: string) =>
    body.items.find(
      (item) => item.source === 'serp' && item.storeAppId === storeAppId,
    );

  it('describes a keyword result from the home market, not the newest storefront', async () => {
    const primary = await createPrimary('us');
    await seedSerp(
      primary.id,
      [
        {
          storeAppId: '222000222',
          position: 6,
          date: D2,
          title: 'Email by Google',
        },
      ],
      'us',
    );
    await seedSerp(
      primary.id,
      [
        {
          storeAppId: '222000222',
          position: 4,
          date: D1,
          title: 'E-Mail von Google',
        },
      ],
      'de',
    );

    const res = await suggest(primary.id).expect(200);

    expect(
      serpItem(res.body as CompetitorSuggestions, '222000222'),
    ).toMatchObject({
      title: 'Email by Google',
      appearances: 2,
      bestPosition: 4,
    });
  });

  it('answers the same title when the foreign rows are the same age', async () => {
    const primary = await createPrimary('us');
    await seedSerp(
      primary.id,
      [
        {
          storeAppId: '222000222',
          position: 6,
          date: D1,
          title: 'Email by Google',
        },
      ],
      'us',
    );
    await seedSerp(
      primary.id,
      [
        {
          storeAppId: '222000222',
          position: 4,
          date: D1,
          title: 'E-Mail von Google',
        },
      ],
      'de',
    );

    const first = await suggest(primary.id).expect(200);
    const second = await suggest(primary.id).expect(200);

    expect(
      serpItem(first.body as CompetitorSuggestions, '222000222')?.title,
    ).toBe('Email by Google');
    expect(second.body).toEqual(first.body);
  });

  it('keeps a known icon when the home row predates icons', async () => {
    const primary = await createPrimary('us');
    await seedSerp(
      primary.id,
      [
        {
          storeAppId: '222000222',
          position: 6,
          date: D2,
          title: 'Email by Google',
          iconUrl: null,
        },
      ],
      'us',
    );
    await seedSerp(
      primary.id,
      [
        {
          storeAppId: '222000222',
          position: 4,
          date: D1,
          title: 'E-Mail von Google',
        },
      ],
      'de',
    );

    const res = await suggest(primary.id).expect(200);

    expect(
      serpItem(res.body as CompetitorSuggestions, '222000222'),
    ).toMatchObject({
      title: 'Email by Google',
      iconUrl: rankedIcon('222000222'),
    });
  });

  it('falls back to the newest storefront when the app never ranked at home', async () => {
    const primary = await createPrimary('us');
    await seedSerp(
      primary.id,
      [{ storeAppId: '222000222', position: 4, date: D2, title: 'Older' }],
      'de',
    );
    await seedSerp(
      primary.id,
      [{ storeAppId: '222000222', position: 5, date: D1, title: 'Newer' }],
      'gb',
    );

    const res = await suggest(primary.id).expect(200);

    expect(
      serpItem(res.body as CompetitorSuggestions, '222000222')?.title,
    ).toBe('Newer');
  });

  it('lists the serp apps first and the similar apps after', async () => {
    const primary = await createPrimary();
    await seedSerp(primary.id, [
      { storeAppId: PRIMARY_ID, position: 1, date: D1 },
      { storeAppId: '222000222', position: 3, date: D1 },
      { storeAppId: '222000222', position: 2, date: D2 },
      { storeAppId: '333000333', position: 7, date: D1 },
    ]);

    const res = await suggest(primary.id).expect(200);

    expect(res.body as CompetitorSuggestions).toEqual({
      store: 'APP_STORE',
      country: 'de',
      similar: 'ok',
      items: [
        {
          storeAppId: '222000222',
          title: 'Ranked 222000222',
          developer: 'Ranked Co',
          iconUrl: rankedIcon('222000222'),
          source: 'serp',
          appearances: 2,
          bestPosition: 2,
        },
        {
          storeAppId: '333000333',
          title: 'Ranked 333000333',
          developer: 'Ranked Co',
          iconUrl: rankedIcon('333000333'),
          source: 'serp',
          appearances: 1,
          bestPosition: 7,
        },
        {
          storeAppId: '444000444',
          title: 'Deep Focus Pro',
          developer: 'Deep Co',
          iconUrl: SIMILAR_ICON,
          source: 'similar',
          appearances: null,
          bestPosition: null,
        },
        {
          storeAppId: '555000555',
          title: 'Study Bunny',
          developer: null,
          iconUrl: null,
          source: 'similar',
          appearances: null,
          bestPosition: null,
        },
      ],
    });
    expect(registry.similarCalls).toEqual([[PRIMARY_ID, 'de']]);
  });

  it('never names the app itself or a tracked competitor', async () => {
    const primary = await createPrimary();
    await seedSerp(primary.id, [
      { storeAppId: '222000222', position: 3, date: D1 },
    ]);
    await api
      .post(`/apps/${primary.id}/competitors`)
      .send({ url: '444000444' })
      .expect(201);
    await api
      .post(`/apps/${primary.id}/competitors`)
      .send({ url: '222000222' })
      .expect(201);

    const res = await suggest(primary.id).expect(200);

    expect(
      (res.body as CompetitorSuggestions).items.map((item) => item.storeAppId),
    ).toEqual(['555000555']);
  });

  it('answers the serp rows when the store fails', async () => {
    registry.failure = new StoreRequestError(
      Store.APP_STORE,
      'similar',
      'boom',
    );
    const primary = await createPrimary();
    await seedSerp(primary.id, [
      { storeAppId: '222000222', position: 3, date: D1 },
    ]);

    const res = await suggest(primary.id).expect(200);

    const body = res.body as CompetitorSuggestions;
    expect(body.similar).toBe('unavailable');
    expect(body.items.map((item) => item.storeAppId)).toEqual(['222000222']);
  });

  it('caps the list at ten', async () => {
    const primary = await createPrimary();
    await seedSerp(
      primary.id,
      Array.from({ length: 12 }, (_, index) => ({
        storeAppId: `9000000${String(index).padStart(2, '0')}`,
        position: (index % 10) + 1,
        date: index < 10 ? D1 : D2,
      })),
    );

    const res = await suggest(primary.id).expect(200);

    const items = (res.body as CompetitorSuggestions).items;
    expect(items).toHaveLength(10);
    expect(items.every((item) => item.source === 'serp')).toBe(true);
  });

  const createPlayPrimary = (withListing = true) =>
    prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.GOOGLE_PLAY,
        storeAppId: PLAY_PRIMARY_ID,
        country: 'us',
        name: 'Lingo',
        ...(withListing && {
          snapshots: {
            create: {
              title: 'Lingo: Learn Languages',
              summary:
                'Learn Spanish, French, English and more with fun, quick lessons.',
              description: 'Fixture',
              raw: {},
            },
          },
        }),
      },
    });

  const suggestedIds = async (appId: string) =>
    (
      (await suggest(appId).expect(200)).body as CompetitorSuggestions
    ).items.map((item) => item.storeAppId);

  it('keeps only the google play similar apps that share the listing terms', async () => {
    const primary = await createPlayPrimary();

    expect(await suggestedIds(primary.id)).toEqual(['com.words.app']);
  });

  it('judges google play similar apps without the tracked competitors', async () => {
    const primary = await createPlayPrimary();
    await api
      .post(`/apps/${primary.id}/competitors`)
      .send({
        url: 'https://play.google.com/store/apps/details?id=com.words.app',
      })
      .expect(201);

    expect(await suggestedIds(primary.id)).toEqual(['com.speak.app']);
  });

  it('keeps the store order for a google play app without a listing', async () => {
    const primary = await createPlayPrimary(false);

    expect(await suggestedIds(primary.id)).toEqual(
      PLAY_SIMILAR.map((item) => item.storeAppId),
    );
  });

  it('answers 404 for a competitor app and an unknown app', async () => {
    const primary = await createPrimary();
    const competitor = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '666000666',
        country: 'de',
        isCompetitor: true,
        primaryAppId: primary.id,
      },
    });

    await suggest(competitor.id).expect(404);
    await suggest('missing-app').expect(404);
    expect(registry.similarCalls).toEqual([]);
  });
});
