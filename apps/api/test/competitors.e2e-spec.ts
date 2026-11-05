import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import {
  CompetitorAnalysis,
  CompetitorDiscovery,
  CompetitorGapKeyword,
  KeywordComparison,
  TrackedKeywordItem,
} from '@asobeast/shared';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import {
  addDays,
  toDateKey,
  utcToday,
} from '../src/analytics/analytics.support';
import { existingGapLists } from '../src/competitors/competitor-gaps';
import { testDb } from './helpers/test-db';
import { ownerAgent, useCookies } from './helpers/session';
import { obliterateQueues, settleBootRegistration } from './obliterate-queues';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';

const D0 = addDays(utcToday(), -1);

describe('CompetitorsController (e2e)', () => {
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
    }).compile();

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
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const seed = async (): Promise<string> => {
    const primary = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '111',
        country: 'us',
        name: 'Habit Tracker',
      },
    });
    const competitor = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '222',
        country: 'us',
        name: 'Streak Master',
        isCompetitor: true,
        primaryAppId: primary.id,
      },
    });
    for (const target of [
      {
        id: primary.id,
        title: 'Habit Tracker',
        subtitle: 'Daily Counter',
        rating: 4.7,
      },
      {
        id: competitor.id,
        title: 'Streak Master',
        subtitle: 'Habit Coach',
        rating: 4.2,
      },
    ]) {
      await prisma.appSnapshot.create({
        data: {
          appId: target.id,
          title: target.title,
          subtitle: target.subtitle,
          description: 'desc',
          ratingAvg: target.rating,
          raw: {},
          capturedAt: D0,
        },
      });
    }

    const rows = [
      { text: 'habit tracker', you: null, them: 5 },
      { text: 'streak counter', you: 3, them: null },
      { text: 'daily goals', you: 20, them: 5 },
      { text: 'sleep timer', you: 2, them: 8 },
    ];
    for (const row of rows) {
      const keyword = await prisma.keyword.create({
        data: { text: row.text, store: Store.APP_STORE, country: 'us' },
      });
      await prisma.trackedKeyword.create({
        data: {
          appId: primary.id,
          keywordId: keyword.id,
          source: 'MANUAL',
          active: true,
        },
      });
      await prisma.keywordMetric.create({
        data: { keywordId: keyword.id, date: D0, traffic: 7, difficulty: 3 },
      });
      await prisma.keywordRanking.create({
        data: {
          appId: primary.id,
          workspaceId: DEFAULT_WORKSPACE_ID,
          keywordId: keyword.id,
          date: D0,
          position: row.you,
          depth: 100,
        },
      });
      await prisma.keywordRanking.create({
        data: {
          appId: competitor.id,
          workspaceId: DEFAULT_WORKSPACE_ID,
          keywordId: keyword.id,
          date: D0,
          position: row.them,
          depth: 100,
        },
      });
    }
    return primary.id;
  };

  it('returns the three gap tables and the position map', async () => {
    const id = await seed();

    const response = await api
      .get(`/apps/${id}/competitors/analysis`)
      .expect(200);
    const analysis = response.body as CompetitorAnalysis;

    expect(analysis.gaps.theyRankYouDont.map((k) => k.text)).toEqual([
      'habit tracker',
    ]);
    expect(analysis.gaps.youRankTheyDont.map((k) => k.text)).toEqual([
      'streak counter',
    ]);

    const outranked = analysis.gaps.outranked.find(
      (k) => k.text === 'daily goals',
    );
    expect(outranked?.yourPosition).toBe(20);
    expect(outranked?.bestCompetitorPosition).toBe(5);
    expect(outranked?.gap).toBe(15);

    expect(analysis.metadataComparison).toHaveLength(2);
    const you = analysis.positionMap.find((p) => p.isYou);
    expect(you?.name).toBe('Habit Tracker');
    expect(analysis.positionMap).toHaveLength(2);
  });
  interface Check {
    date: Date;
    you: number | null;
    them?: number | null;
  }

  const competitorOf = (primaryId: string) =>
    prisma.app.findFirstOrThrow({ where: { primaryAppId: primaryId } });

  const addCompetitor = (primaryId: string, storeAppId: string) =>
    prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId,
        country: 'us',
        name: `Rival ${storeAppId}`,
        isCompetitor: true,
        primaryAppId: primaryId,
      },
    });

  const ranking = (
    appId: string,
    keywordId: string,
    date: Date,
    position: number | null,
  ) =>
    prisma.keywordRanking.create({
      data: {
        appId,
        workspaceId: DEFAULT_WORKSPACE_ID,
        keywordId,
        date,
        position,
        depth: 100,
      },
    });

  interface TrackedChecks {
    primaryId: string;
    competitorId: string | null;
    text: string;
    checks: Check[];
    country?: string;
  }

  const trackChecks = async ({
    primaryId,
    competitorId,
    text,
    checks,
    country = 'us',
  }: TrackedChecks): Promise<string> => {
    const keyword = await prisma.keyword.create({
      data: { text, store: Store.APP_STORE, country },
    });
    await prisma.trackedKeyword.create({
      data: {
        appId: primaryId,
        keywordId: keyword.id,
        source: 'MANUAL',
        active: true,
      },
    });
    await prisma.keywordMetric.create({
      data: { keywordId: keyword.id, date: D0, traffic: 7, difficulty: 3 },
    });
    for (const check of checks) {
      await ranking(primaryId, keyword.id, check.date, check.you);
      if (competitorId !== null && check.them !== undefined) {
        await ranking(competitorId, keyword.id, check.date, check.them);
      }
    }
    return keyword.id;
  };

  const primaryApp = () =>
    prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: 'alone',
        country: 'us',
        name: 'Alone',
      },
    });

  const analysisOf = async (id: string): Promise<CompetitorAnalysis> =>
    (await api.get(`/apps/${id}/competitors/analysis`).expect(200))
      .body as CompetitorAnalysis;

  const textsOf = (rows: CompetitorGapKeyword[] | undefined) =>
    (rows ?? []).map((row) => row.text);

  const seedWithOvertake = async (): Promise<string> => {
    const id = await seed();
    const competitor = await competitorOf(id);
    await trackChecks({
      primaryId: id,
      competitorId: competitor.id,
      text: 'focus',
      checks: [
        { date: D0, you: 12, them: 8 },
        { date: addDays(D0, -1), you: 9, them: 10 },
      ],
    });
    return id;
  };

  it('answers the keyword gaps, winnable keywords, threats and leads', async () => {
    const id = await seedWithOvertake();

    const { gaps } = await analysisOf(id);

    expect(textsOf(gaps.keywordGaps)).toEqual(['habit tracker']);
    expect(textsOf(gaps.winnable)).toEqual(['habit tracker']);
    expect(gaps.winnable?.[0]).toMatchObject({
      difficulty: 30,
      volume: 70,
      country: 'us',
      lastCheckedOn: toDateKey(D0),
    });
    expect(gaps.threats).toEqual([
      expect.objectContaining({
        text: 'focus',
        threat: 'overtook',
        yourPosition: 12,
        bestCompetitorPosition: 8,
        competitorDelta: 2,
        overtookOn: toDateKey(D0),
      }),
    ]);
    expect((gaps.lead ?? []).map(({ text, gap }) => ({ text, gap }))).toEqual(
      expect.arrayContaining([
        { text: 'streak counter', gap: null },
        { text: 'sleep timer', gap: 6 },
      ]),
    );
    expect(gaps.lead).toHaveLength(2);
    expect(gaps.coverage).toEqual({
      competitors: 1,
      delisted: 0,
      markets: [{ country: 'us', keywords: 5, compared: 5 }],
    });
  });

  it('keeps the three older gap tables as the unchanged builders answer them', async () => {
    const id = await seedWithOvertake();

    const analysis = await analysisOf(id);
    const comparison = (
      await api.get(`/apps/${id}/keywords/compare`).expect(200)
    ).body as KeywordComparison;
    const tracked = (await api.get(`/apps/${id}/keywords`).expect(200))
      .body as TrackedKeywordItem[];

    expect({
      theyRankYouDont: analysis.gaps.theyRankYouDont,
      youRankTheyDont: analysis.gaps.youRankTheyDont,
      outranked: analysis.gaps.outranked,
    }).toEqual(
      existingGapLists(
        comparison,
        new Map(tracked.map((item) => [item.keywordId, item])),
      ),
    );
  });

  it('leaves a delisted competitor out of every new list', async () => {
    const id = await seedWithOvertake();
    const competitor = await competitorOf(id);
    await prisma.app.update({
      where: { id: competitor.id },
      data: { delistedAt: D0 },
    });

    const { gaps } = await analysisOf(id);

    expect(gaps.theyRankYouDont).toHaveLength(1);
    expect(gaps).toMatchObject({
      keywordGaps: [],
      winnable: [],
      threats: [],
      lead: [],
      coverage: { competitors: 0, delisted: 1 },
    });
  });

  it('claims no lead over a competitor nobody checked yet', async () => {
    const id = await seed();
    await addCompetitor(id, 'late');

    const { gaps } = await analysisOf(id);

    expect(gaps.lead).toEqual([]);
    expect(gaps.coverage?.competitors).toBe(2);
  });

  it('keeps a stale gap with the day of its last check and no threat', async () => {
    const primary = await primaryApp();
    const competitor = await addCompetitor(primary.id, 'rival');
    const stale = addDays(utcToday(), -3);
    await trackChecks({
      primaryId: primary.id,
      competitorId: competitor.id,
      text: 'stale gap',
      checks: [{ date: stale, you: null, them: 5 }],
    });
    await trackChecks({
      primaryId: primary.id,
      competitorId: competitor.id,
      text: 'stale threat',
      checks: [
        { date: stale, you: 5, them: 7 },
        { date: addDays(stale, -1), you: 5, them: 9 },
      ],
    });

    const { gaps } = await analysisOf(primary.id);

    expect(gaps.keywordGaps).toEqual([
      expect.objectContaining({
        text: 'stale gap',
        lastCheckedOn: toDateKey(stale),
      }),
    ]);
    expect(gaps.threats).toEqual([]);
  });

  it('answers empty lists for an app without competitors', async () => {
    const primary = await primaryApp();
    await trackChecks({
      primaryId: primary.id,
      competitorId: null,
      text: 'lonely',
      checks: [{ date: D0, you: 4 }],
    });

    const { gaps } = await analysisOf(primary.id);

    expect(gaps).toMatchObject({
      keywordGaps: [],
      winnable: [],
      threats: [],
      lead: [],
      coverage: {
        competitors: 0,
        delisted: 0,
        markets: [{ country: 'us', keywords: 1, compared: 0 }],
      },
    });
  });

  it('answers each market of a keyword on its own row', async () => {
    const id = await seed();
    const competitor = await competitorOf(id);
    await trackChecks({
      primaryId: id,
      competitorId: competitor.id,
      text: 'habit tracker',
      checks: [{ date: D0, you: null, them: 4 }],
      country: 'de',
    });

    const { gaps } = await analysisOf(id);

    expect(
      (gaps.keywordGaps ?? []).map(({ text, country }) => ({ text, country })),
    ).toEqual(
      expect.arrayContaining([
        { text: 'habit tracker', country: 'us' },
        { text: 'habit tracker', country: 'de' },
      ]),
    );
    expect(gaps.coverage?.markets).toEqual([
      { country: 'de', keywords: 1, compared: 1 },
      { country: 'us', keywords: 4, compared: 4 },
    ]);
  });

  it('counts the title and subtitle of the comparison in characters', async () => {
    const id = await seed();
    await prisma.appSnapshot.updateMany({
      where: { appId: id },
      data: { title: '𠮷野家', subtitle: '𪚥𪚥𪚥' },
    });

    const response = await api
      .get(`/apps/${id}/competitors/analysis`)
      .expect(200);
    const you = (response.body as CompetitorAnalysis).metadataComparison.find(
      (row) => row.isYou,
    );

    expect(you).toMatchObject({ titleChars: 3, subtitleChars: 3 });
  });

  it('discovers untracked apps from serp entries, excluding known apps', async () => {
    const primary = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: 'self',
        country: 'us',
        name: 'You',
      },
    });
    await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: 'rival',
        country: 'us',
        name: 'Rival',
        isCompetitor: true,
        primaryAppId: primary.id,
      },
    });
    const keyword = await prisma.keyword.create({
      data: { text: 'habit tracker', store: Store.APP_STORE, country: 'us' },
    });
    await prisma.trackedKeyword.create({
      data: {
        appId: primary.id,
        keywordId: keyword.id,
        source: 'MANUAL',
        active: true,
      },
    });
    await prisma.serpEntry.createMany({
      data: [
        {
          keywordId: keyword.id,
          date: D0,
          position: 1,
          storeAppId: 'self',
          title: 'You',
        },
        {
          keywordId: keyword.id,
          date: D0,
          position: 2,
          storeAppId: 'rival',
          title: 'Rival',
        },
        {
          keywordId: keyword.id,
          date: D0,
          position: 3,
          storeAppId: 'stranger',
          title: 'Stranger',
          developer: 'Someone',
        },
      ],
    });

    const response = await api
      .get(`/apps/${primary.id}/competitors/discovery?days=90`)
      .expect(200);
    const discovery = response.body as CompetitorDiscovery;

    expect(discovery.windowDays).toBe(90);
    expect(discovery.items).toHaveLength(1);
    expect(discovery.items[0]).toMatchObject({
      storeAppId: 'stranger',
      appearances: 1,
      bestPosition: 3,
    });
  });

  it('discovers only apps seen in the top 10', async () => {
    const primary = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: 'self',
        country: 'us',
        name: 'You',
      },
    });
    const keyword = await prisma.keyword.create({
      data: { text: 'habit tracker', store: Store.APP_STORE, country: 'us' },
    });
    await prisma.trackedKeyword.create({
      data: {
        appId: primary.id,
        keywordId: keyword.id,
        source: 'MANUAL',
        active: true,
      },
    });
    const yesterday = new Date(D0.getTime() - 24 * 60 * 60 * 1000);
    await prisma.serpEntry.createMany({
      data: [D0, yesterday].flatMap((date) => [
        {
          keywordId: keyword.id,
          date,
          position: 3,
          storeAppId: 'stranger',
          title: 'Stranger',
        },
        {
          keywordId: keyword.id,
          date,
          position: 11,
          storeAppId: 'deep-app',
          title: 'Deep',
        },
      ]),
    });

    const response = await api
      .get(`/apps/${primary.id}/competitors/discovery?days=90`)
      .expect(200);

    expect(
      (response.body as CompetitorDiscovery).items.map(
        (item) => item.storeAppId,
      ),
    ).toEqual(['stranger']);
  });

  it('describes a discovered app from the home market', async () => {
    const primary = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: 'self',
        country: 'us',
        name: 'You',
      },
    });
    for (const [country, title, ratingAvg] of [
      ['de', 'Fremder', 3],
      ['us', 'Stranger', 4.5],
    ] as const) {
      const keyword = await prisma.keyword.create({
        data: { text: 'habit tracker', store: Store.APP_STORE, country },
      });
      await prisma.trackedKeyword.create({
        data: {
          appId: primary.id,
          keywordId: keyword.id,
          source: 'MANUAL',
          active: true,
        },
      });
      await prisma.serpEntry.create({
        data: {
          keywordId: keyword.id,
          date: D0,
          position: 3,
          storeAppId: 'stranger',
          title,
          ratingAvg,
        },
      });
    }

    const response = await api
      .get(`/apps/${primary.id}/competitors/discovery?days=90`)
      .expect(200);

    expect((response.body as CompetitorDiscovery).items[0]).toMatchObject({
      title: 'Stranger',
      ratingAvg: 4.5,
      appearances: 2,
    });
  });
});
