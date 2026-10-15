import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import { ApiErrorEnvelope, StoreSearchResult } from '@asobeast/shared';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { StoreRequestError } from '../src/store-providers/errors';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import type { SearchItem, StoreProvider } from '../src/store-providers/types';
import { ownerAgent, useCookies } from './helpers/session';
import { testDb } from './helpers/test-db';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

const ICON = 'https://is1-ssl.mzstatic.com/image/thumb/a/512x512bb.jpg';

const RESULTS: SearchItem[] = [
  {
    storeAppId: '123456789',
    title: 'Focus Timer',
    developer: 'Acme',
    ratingAvg: 4.6,
    ratingCount: 1200,
    iconUrl: ICON,
  },
  { storeAppId: '987654321', title: 'Focus Plain' },
];

type SearchCall = [store: Store, term: string, country: string, num: number];

class SearchRegistry {
  calls: SearchCall[] = [];
  failure: Error | null = null;

  get(store: Store): StoreProvider {
    return {
      store,
      search: (term: string, country: string, num: number) => {
        this.calls.push([store, term, country, num]);
        return this.failure
          ? Promise.reject(this.failure)
          : Promise.resolve(RESULTS);
      },
    } as unknown as StoreProvider;
  }
}

describe('Store search (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;
  const registry = new SearchRegistry();

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

  beforeEach(() => {
    registry.calls = [];
    registry.failure = null;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const search = (query: string) => api.get(`/store/search?${query}`);

  it("lists the store's answer for a name", async () => {
    const res = await search('store=APP_STORE&country=us&q=focus').expect(200);

    expect(res.body as StoreSearchResult[]).toEqual([
      {
        storeAppId: '123456789',
        title: 'Focus Timer',
        developer: 'Acme',
        ratingAvg: 4.6,
        ratingCount: 1200,
        iconUrl: ICON,
      },
      {
        storeAppId: '987654321',
        title: 'Focus Plain',
        developer: null,
        ratingAvg: null,
        ratingCount: null,
        iconUrl: null,
      },
    ]);
    expect(registry.calls).toEqual([[Store.APP_STORE, 'focus', 'us', 10]]);
  });

  it('passes the limit through and caps it', async () => {
    const res = await search(
      'store=APP_STORE&country=us&q=focus&limit=1',
    ).expect(200);

    expect(res.body as StoreSearchResult[]).toHaveLength(1);
    expect(registry.calls).toEqual([[Store.APP_STORE, 'focus', 'us', 1]]);
    await search('store=APP_STORE&country=us&q=focus&limit=26').expect(400);
    await search('store=APP_STORE&country=us&q=focus&limit=0').expect(400);
    expect(registry.calls).toHaveLength(1);
  });

  it('trims the query', async () => {
    await search('store=APP_STORE&country=us&q=%20focus%20').expect(200);

    expect(registry.calls).toEqual([[Store.APP_STORE, 'focus', 'us', 10]]);
  });

  it('refuses a bad store, a bad country and a bad query', async () => {
    await search('store=OTHER&country=us&q=focus').expect(400);
    await search('store=APP_STORE&country=usa&q=focus').expect(400);
    await search('store=APP_STORE&country=us&q=').expect(400);
    await search('store=APP_STORE&country=us&q=%20%20').expect(400);
    await search(`store=APP_STORE&country=us&q=${'a'.repeat(81)}`).expect(400);
    await search('store=APP_STORE&country=us').expect(400);

    expect(registry.calls).toEqual([]);
  });

  it('refuses a storefront the store does not have', async () => {
    const res = await search('store=GOOGLE_PLAY&country=pw&q=focus').expect(
      400,
    );

    expect((res.body as ApiErrorEnvelope).message).toBe(
      'pw is not a Google Play location',
    );
    expect(registry.calls).toEqual([]);
  });

  it("answers the store's failure as a bad gateway", async () => {
    registry.failure = new StoreRequestError(Store.APP_STORE, 'search', 'boom');

    await search('store=APP_STORE&country=us&q=focus').expect(502);
  });

  it('searches google play in its storefront', async () => {
    await search('store=GOOGLE_PLAY&country=de&q=fokus').expect(200);

    expect(registry.calls).toEqual([[Store.GOOGLE_PLAY, 'fokus', 'de', 10]]);
  });
});
