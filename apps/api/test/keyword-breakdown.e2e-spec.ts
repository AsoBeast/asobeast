import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import type {
  KeywordBreakdown,
  KeywordBreakdownApp,
  KeywordBreakdownListing,
} from '@asobeast/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { utcToday } from '../src/analytics/analytics.support';
import { OnDemandLimiter } from '../src/auth/on-demand.limiter';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { seedApiToken } from './helpers/api-tokens';
import { testDb } from './helpers/test-db';
import { ownerAgent, useCookies } from './helpers/session';
import { obliterateQueues, settleBootRegistration } from './obliterate-queues';

interface Seeded {
  prim: string;
  rival: string;
  late: string;
  play: string;
  usKeyword: string;
  deKeyword: string;
  playKeyword: string;
}

describe('KeywordsController breakdown (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;
  let seeded: Seeded;

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
      .useValue({
        get: () => {
          throw new Error('the keyword breakdown must never touch a store');
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    useCookies(app);
    await app.init();
    await settleBootRegistration(app);

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
    seeded = await seed();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const createApp = (data: {
    store?: Store;
    storeAppId: string;
    name: string;
    primaryAppId?: string;
  }) =>
    prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: data.store ?? Store.APP_STORE,
        storeAppId: data.storeAppId,
        country: 'us',
        name: data.name,
        isCompetitor: data.primaryAppId !== undefined,
        primaryAppId: data.primaryAppId,
      },
    });

  const snapshot = (
    appId: string,
    title: string,
    extra: {
      subtitle?: string;
      summary?: string;
      description?: string;
      ratingCount?: number;
      country?: string;
      localization?: string;
    } = {},
  ) =>
    prisma.appSnapshot.create({
      data: {
        appId,
        title,
        subtitle: extra.subtitle,
        summary: extra.summary,
        description: extra.description ?? 'A listing',
        ratingAvg: 4.5,
        ratingCount: extra.ratingCount,
        country: extra.country,
        localization: extra.localization,
        raw: {},
      },
    });

  const trackedKeyword = async (
    appId: string,
    text: string,
    country: string,
    store: Store = Store.APP_STORE,
  ) => {
    const keyword = await prisma.keyword.create({
      data: { text, store, country },
    });
    await prisma.trackedKeyword.create({
      data: { appId, keywordId: keyword.id, source: 'MANUAL', active: true },
    });
    return keyword.id;
  };

  const ranking = (appId: string, keywordId: string, position: number) =>
    prisma.keywordRanking.create({
      data: {
        appId,
        workspaceId: DEFAULT_WORKSPACE_ID,
        keywordId,
        date: utcToday(),
        position,
        depth: 200,
      },
    });

  async function seed(): Promise<Seeded> {
    const prim = await createApp({ storeAppId: '100', name: 'Habit Pro' });
    const rival = await createApp({
      storeAppId: '200',
      name: 'Rival Habits',
      primaryAppId: prim.id,
    });
    const late = await createApp({
      storeAppId: '300',
      name: 'Late App',
      primaryAppId: prim.id,
    });
    await snapshot(prim.id, 'Habit Pro: Daily Tracker', {
      subtitle: 'Streaks and goals',
      ratingCount: 120,
    });
    await snapshot(rival.id, 'Habit Tracker', {
      subtitle: 'Build routines',
      ratingCount: 5000,
    });
    await snapshot(late.id, 'Late App');
    await prisma.appLocalization.create({
      data: {
        appId: prim.id,
        workspaceId: DEFAULT_WORKSPACE_ID,
        localization: 'es-MX',
        origin: 'manual',
      },
    });
    await snapshot(prim.id, 'Hábitos diarios', { localization: 'es-MX' });
    await prisma.keywordField.create({
      data: {
        appId: prim.id,
        workspaceId: DEFAULT_WORKSPACE_ID,
        localization: 'en-US',
        phrases: ['habit tracker', 'routine'],
      },
    });
    const usKeyword = await trackedKeyword(prim.id, 'habit tracker', 'us');
    await ranking(prim.id, usKeyword, 12);
    await ranking(rival.id, usKeyword, 3);
    const deKeyword = await trackedKeyword(prim.id, 'habit tracker', 'de');
    await snapshot(prim.id, 'Gewohnheiten', { country: 'de' });

    const play = await createApp({
      store: Store.GOOGLE_PLAY,
      storeAppId: 'com.example.play',
      name: 'Focus Play',
    });
    const playRival = await createApp({
      store: Store.GOOGLE_PLAY,
      storeAppId: 'com.example.rival',
      name: 'Play Rival',
      primaryAppId: play.id,
    });
    await snapshot(play.id, 'Focus', {
      summary: 'Timer for deep work',
      description: 'The focus timer for every day',
    });
    await snapshot(playRival.id, 'Focus Timer');
    const playKeyword = await trackedKeyword(
      play.id,
      'focus timer',
      'us',
      Store.GOOGLE_PLAY,
    );
    return {
      prim: prim.id,
      rival: rival.id,
      late: late.id,
      play: play.id,
      usKeyword,
      deKeyword,
      playKeyword,
    };
  }

  const breakdown = async (appId: string, keywordId: string) =>
    (
      await api
        .get(`/apps/${appId}/keywords/${keywordId}/breakdown`)
        .expect(200)
    ).body as KeywordBreakdown;

  const appOf = (result: KeywordBreakdown, appId: string) =>
    result.apps.find((each) => each.appId === appId) as KeywordBreakdownApp;

  const listingOf = (entry: KeywordBreakdownApp, localization: string | null) =>
    entry.listings.find(
      (listing) => listing.localization === localization,
    ) as KeywordBreakdownListing;

  it('answers you first and every competitor with its ranking', async () => {
    const result = await breakdown(seeded.prim, seeded.usKeyword);

    expect(result.apps[0]).toMatchObject({ appId: seeded.prim, isYou: true });
    expect(appOf(result, seeded.rival).ranking?.position).toBe(3);
    expect(appOf(result, seeded.late).ranking).toBeNull();
    expect(result.standing).toMatchObject({
      above: 1,
      competitors: 2,
      checked: true,
    });
  });

  it('judges your title, subtitle and keyword field', async () => {
    const you = appOf(
      await breakdown(seeded.prim, seeded.usKeyword),
      seeded.prim,
    );
    const english = listingOf(you, 'en-US');
    const title = english.fields.find((field) => field.field === 'title');
    expect(title).toMatchObject({
      phrase: false,
      words: [
        { word: 'habit', match: 'exact' },
        { word: 'tracker', match: 'exact' },
      ],
    });
    expect(
      english.fields.find((field) => field.field === 'keywordField')?.phrase,
    ).toBe(true);
    expect(you.placement).toBe('keywordField');
  });

  it("judges a competitor's title and never its keyword field", async () => {
    const rival = appOf(
      await breakdown(seeded.prim, seeded.usKeyword),
      seeded.rival,
    );
    expect(rival.placement).toBe('title');
    expect(
      rival.listings.flatMap((listing) =>
        listing.fields.map((field) => field.field),
      ),
    ).not.toContain('keywordField');
  });

  it('notes why the competitor ranks above', async () => {
    const result = await breakdown(seeded.prim, seeded.usKeyword);
    expect(appOf(result, seeded.rival).insight).toEqual({
      rule: 'placement',
      theirs: 'title',
      yours: 'keywordField',
    });
    expect(appOf(result, seeded.late).insight).toBeNull();
  });

  it('judges your Spanish listing on its own', async () => {
    const you = appOf(
      await breakdown(seeded.prim, seeded.usKeyword),
      seeded.prim,
    );
    expect(listingOf(you, 'es-MX').role).toBe('additional');
    expect(you.unread).not.toContain('es-MX');
  });

  it('names the localizations of a competitor it could not read', async () => {
    const rival = appOf(
      await breakdown(seeded.prim, seeded.usKeyword),
      seeded.rival,
    );
    expect(rival.unread).toContain('es-MX');
  });

  it('falls back to the home listing in another market', async () => {
    const result = await breakdown(seeded.prim, seeded.deKeyword);
    const rival = appOf(result, seeded.rival);
    expect(rival.listingCountry).toBe('us');
    expect(rival.rating?.country).toBe('us');
    expect(appOf(result, seeded.prim).listingCountry).toBe('de');
    expect(result.country).toBe('de');
    expect(rival.insight).toBeNull();
  });

  it('judges the long description on Google Play without returning it', async () => {
    const result = await breakdown(seeded.play, seeded.playKeyword);
    for (const entry of result.apps) {
      for (const listing of entry.listings) {
        expect(listing.localization).toBeNull();
        expect(listing.fields.map((field) => field.field)).not.toContain(
          'keywordField',
        );
      }
    }
    const description = listingOf(appOf(result, seeded.play), null).fields.find(
      (field) => field.field === 'description',
    );
    expect(description).toMatchObject({ phrase: true, segments: null });
  });

  it('answers 404 for a keyword the app does not track', async () => {
    await api.get(`/apps/${seeded.prim}/keywords/nope/breakdown`).expect(404);
  });

  it('answers 404 for an unknown app', async () => {
    await api
      .get(`/apps/nope/keywords/${seeded.usKeyword}/breakdown`)
      .expect(404);
  });

  it('answers 400 for a competitor app id', async () => {
    await api
      .get(`/apps/${seeded.rival}/keywords/${seeded.usKeyword}/breakdown`)
      .expect(400);
  });

  it('answers 404 for a keyword of another app of the workspace', async () => {
    await api
      .get(`/apps/${seeded.prim}/keywords/${seeded.playKeyword}/breakdown`)
      .expect(404);
  });

  it('answers a read scoped token', async () => {
    const token = await seedApiToken(prisma, {
      seed: 'breakdownreader',
      email: 'reader@example.com',
      workspaceId: DEFAULT_WORKSPACE_ID,
      role: 'member',
      scope: 'read',
    });
    await request(app.getHttpServer())
      .get(`/apps/${seeded.prim}/keywords/${seeded.usKeyword}/breakdown`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('spends nothing', async () => {
    const consume = jest.spyOn(app.get(OnDemandLimiter), 'consume');
    try {
      await breakdown(seeded.prim, seeded.usKeyword);
      expect(consume).not.toHaveBeenCalled();
    } finally {
      consume.mockRestore();
    }
  });
});
