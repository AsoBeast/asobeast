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
          : Promise.resolve(SIMILAR);
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

  const createPrimary = () =>
    prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: PRIMARY_ID,
        country: 'de',
        name: 'Focus',
      },
    });

  const seedSerp = async (
    appId: string,
    entries: { storeAppId: string; position: number; date: Date }[],
  ) => {
    const keyword = await prisma.keyword.create({
      data: { text: 'focus timer', store: Store.APP_STORE, country: 'de' },
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
        title: `Ranked ${entry.storeAppId}`,
        developer: 'Ranked Co',
      })),
    });
  };

  const suggest = (appId: string) =>
    api.get(`/apps/${appId}/competitors/suggestions`);

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
          iconUrl: null,
          source: 'serp',
          appearances: 2,
          bestPosition: 2,
        },
        {
          storeAppId: '333000333',
          title: 'Ranked 333000333',
          developer: 'Ranked Co',
          iconUrl: null,
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
        position: index + 2,
        date: D1,
      })),
    );

    const res = await suggest(primary.id).expect(200);

    const items = (res.body as CompetitorSuggestions).items;
    expect(items).toHaveLength(10);
    expect(items.every((item) => item.source === 'serp')).toBe(true);
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
