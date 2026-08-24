import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import {
  ApiErrorEnvelope,
  AppSummary,
  PortfolioSummary,
  RankDistributionHistory,
  RatingsHistory,
  VisibilityHistory,
} from '@asobeast/shared';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { testDb } from './helpers/test-db';
import { ownerAgent, useCookies } from './helpers/session';
import { DigestService } from '../src/analytics/digest.service';
import { obliterateQueues } from './obliterate-queues';
import { asWorkspace } from './helpers/tenancy';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';

const D0 = new Date('2026-06-30T00:00:00.000Z');
const D7 = new Date('2026-06-23T00:00:00.000Z');

interface Seeded {
  keywordId: string;
  text: string;
  ranks: Array<{ date: Date; position: number | null }>;
  traffic: number;
  difficulty: number;
}

describe('AnalyticsController (e2e)', () => {
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
    const app = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '1234567890',
        country: 'us',
        name: 'Habit Tracker',
      },
    });

    await prisma.appSnapshot.create({
      data: {
        appId: app.id,
        title: 'Habit Tracker',
        subtitle: 'Daily streak counter',
        description: 'Build habits every day',
        raw: {},
        capturedAt: D0,
      },
    });

    const keywords: Seeded[] = [
      {
        keywordId: '',
        text: 'habit tracker',
        traffic: 8,
        difficulty: 3,
        ranks: [
          { date: D7, position: 24 },
          { date: D0, position: 11 },
        ],
      },
      {
        keywordId: '',
        text: 'streak app',
        traffic: 5,
        difficulty: 4,
        ranks: [
          { date: D7, position: 6 },
          { date: D0, position: 14 },
        ],
      },
      {
        keywordId: '',
        text: 'daily goals',
        traffic: 8,
        difficulty: 2,
        ranks: [],
      },
      {
        keywordId: '',
        text: 'habit',
        traffic: 9,
        difficulty: 5,
        ranks: [
          { date: D7, position: 2 },
          { date: D0, position: 1 },
        ],
      },
    ];

    for (const kw of keywords) {
      const keyword = await prisma.keyword.create({
        data: { text: kw.text, store: Store.APP_STORE, country: 'us' },
      });
      await prisma.trackedKeyword.create({
        data: {
          appId: app.id,
          keywordId: keyword.id,
          source: 'MANUAL',
          active: true,
        },
      });
      await prisma.keywordMetric.create({
        data: {
          keywordId: keyword.id,
          date: D7,
          traffic: kw.traffic,
          difficulty: kw.difficulty,
        },
      });
      for (const rank of kw.ranks) {
        await prisma.keywordRanking.create({
          data: {
            appId: app.id,
            workspaceId: DEFAULT_WORKSPACE_ID,
            keywordId: keyword.id,
            date: rank.date,
            position: rank.position,
            depth: 100,
          },
        });
      }
    }

    return app.id;
  };

  const seedLinkedPair = async (): Promise<{
    id: string;
    group: string;
    play: string;
  }> => {
    const id = await seed();
    const group = await prisma.appGroup.create({
      data: { workspaceId: DEFAULT_WORKSPACE_ID, name: 'Habit' },
    });
    const play = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.GOOGLE_PLAY,
        storeAppId: 'com.habit.tracker',
        country: 'us',
        name: 'Habit Tracker',
        groupId: group.id,
      },
    });
    await prisma.app.update({ where: { id }, data: { groupId: group.id } });

    const keyword = await prisma.keyword.create({
      data: { text: 'habit tracker', store: Store.GOOGLE_PLAY, country: 'us' },
    });
    await prisma.trackedKeyword.create({
      data: {
        appId: play.id,
        keywordId: keyword.id,
        source: 'MANUAL',
        active: true,
      },
    });
    await prisma.keywordMetric.create({
      data: { keywordId: keyword.id, date: D7, traffic: 8, difficulty: 3 },
    });
    await prisma.keywordRanking.create({
      data: {
        appId: play.id,
        workspaceId: DEFAULT_WORKSPACE_ID,
        keywordId: keyword.id,
        date: D0,
        position: 1,
        depth: 100,
      },
    });

    return { id, group: group.id, play: play.id };
  };

  it('computes every summary block from seeded rows', async () => {
    const id = await seed();

    const response = await api.get(`/apps/${id}/summary`).expect(200);
    const summary = response.body as AppSummary;

    expect(summary.visibility.current).toBeCloseTo(41.7, 1);
    expect(summary.visibility.delta7d).toBeCloseTo(11.1, 1);
    expect(summary.visibility.delta30d).toBeNull();

    expect(summary.rankDistribution).toEqual({
      top1: 1,
      top3: 1,
      top10: 1,
      top50: 3,
      beyond: 0,
      unranked: 1,
    });

    expect(summary.movers.up[0]).toMatchObject({
      text: 'habit tracker',
      from: 24,
      to: 11,
    });
    expect(summary.movers.down[0]).toMatchObject({
      text: 'streak app',
      from: 6,
      to: 14,
    });

    expect(summary.coverage.inTitle).toBe(2);
    expect(summary.coverage.inSubtitle).toBe(0);
    expect(summary.coverage.inDescription).toBe(0);
    expect(
      summary.coverage.uncoveredHighOpportunity.map((item) => item.text),
    ).toContain('daily goals');

    expect(summary.trackedKeywords).toBe(4);
    expect(summary.competitors).toBe(0);
    expect(summary.lastRefreshAt).toBe(D0.toISOString());
  });

  it('composes a portfolio whose numbers match the app summary', async () => {
    const id = await seed();

    const summaryResponse = await api.get(`/apps/${id}/summary`).expect(200);
    const summary = summaryResponse.body as AppSummary;

    const response = await api.get('/portfolio').expect(200);
    const portfolio = response.body as PortfolioSummary;

    expect(portfolio.apps).toHaveLength(1);
    const [entry] = portfolio.apps;
    expect(entry.id).toBe(id);
    expect(entry.visibility.current).toBeCloseTo(summary.visibility.current, 5);
    expect(entry.visibility.delta7d).toBeCloseTo(
      summary.visibility.delta7d!,
      5,
    );
    expect(entry.trackedKeywords).toBe(summary.trackedKeywords);
    expect(entry.sparkline.map((point) => point.date)).toEqual([
      '2026-06-23',
      '2026-06-30',
    ]);
    expect(entry.lastCapturedAt).toBe(D0.toISOString());

    expect(portfolio.groups).toEqual([]);
    expect(portfolio.totals).toEqual({
      apps: 1,
      competitors: 0,
      trackedKeywords: summary.trackedKeywords,
      changes7d: 0,
    });
  });

  it('blends visibility across a linked pair', async () => {
    const { id, group, play } = await seedLinkedPair();

    const response = await api.get('/portfolio').expect(200);
    const portfolio = response.body as PortfolioSummary;

    expect(portfolio.groups).toHaveLength(1);
    const [entry] = portfolio.groups;
    expect(entry).toMatchObject({ id: group, name: 'Habit' });
    expect(entry.memberAppIds.sort()).toEqual([id, play].sort());

    const ios = portfolio.apps.find((row) => row.id === id)!;
    const android = portfolio.apps.find((row) => row.id === play)!;
    expect(entry.visibility.current).toBeGreaterThan(ios.visibility.current);
    expect(entry.visibility.current).toBeLessThan(android.visibility.current);
    expect(entry.sparkline.map((point) => point.date)).toEqual([
      '2026-06-23',
      '2026-06-30',
    ]);
  });

  it('summarizes the linked pair as one digest group', async () => {
    const { group } = await seedLinkedPair();

    const portfolio = (await api.get('/portfolio').expect(200))
      .body as PortfolioSummary;
    const digest = await asWorkspace(app, () =>
      app.get(DigestService).buildDigest(2),
    );

    expect(digest.groups).toHaveLength(1);
    expect(digest.groups[0]).toMatchObject({ id: group, name: 'Habit' });
    expect(digest.groups[0].visibility.current).toBeCloseTo(
      portfolio.groups[0].visibility.current,
      5,
    );
  });

  it('returns a history whose last point matches current visibility', async () => {
    const id = await seed();

    const summaryResponse = await api.get(`/apps/${id}/summary`).expect(200);
    const current = (summaryResponse.body as AppSummary).visibility.current;

    const response = await api
      .get(`/apps/${id}/visibility-history`)
      .query({ from: '2026-06-20', to: '2026-07-01' })
      .expect(200);
    const history = response.body as VisibilityHistory;

    expect(history.points.map((point) => point.date)).toEqual([
      '2026-06-23',
      '2026-06-30',
    ]);
    const last = history.points[history.points.length - 1];
    expect(last.date).toBe('2026-06-30');
    expect(last.visibility).toBeCloseTo(current, 1);
  });

  it('rejects ranges beyond the 180 day cap', async () => {
    const id = await seed();

    await api
      .get(`/apps/${id}/visibility-history`)
      .query({ from: '2025-01-01', to: '2026-07-01' })
      .expect(400);
  });

  it('groups rank distribution into disjoint bands per day', async () => {
    const id = await seed();

    const response = await api
      .get(`/apps/${id}/rank-distribution-history`)
      .query({ from: '2026-06-20', to: '2026-07-01' })
      .expect(200);
    const history = response.body as RankDistributionHistory;

    expect(history.points).toEqual([
      {
        date: '2026-06-23',
        rank1: 0,
        rank2to3: 1,
        rank4to10: 1,
        rank11to50: 1,
        rank51plus: 0,
        unranked: 0,
      },
      {
        date: '2026-06-30',
        rank1: 1,
        rank2to3: 0,
        rank4to10: 0,
        rank11to50: 2,
        rank51plus: 0,
        unranked: 0,
      },
    ]);
  });

  it('collapses ratings snapshots to one point per UTC day', async () => {
    const created = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '999',
        country: 'us',
        name: 'Rated',
      },
    });
    await prisma.appSnapshot.createMany({
      data: [
        {
          appId: created.id,
          title: 'Rated',
          description: 'd',
          raw: {},
          ratingAvg: 4.4,
          ratingCount: 90,
          capturedAt: new Date('2026-06-23T02:00:00.000Z'),
        },
        {
          appId: created.id,
          title: 'Rated',
          description: 'd',
          raw: {},
          ratingAvg: 4.6,
          ratingCount: 110,
          capturedAt: new Date('2026-06-30T02:00:00.000Z'),
        },
        {
          appId: created.id,
          title: 'Rated',
          description: 'd',
          raw: {},
          ratingAvg: 4.7,
          ratingCount: 120,
          capturedAt: new Date('2026-06-30T20:00:00.000Z'),
        },
      ],
    });

    const response = await api
      .get(`/apps/${created.id}/ratings-history`)
      .query({ from: '2026-06-20', to: '2026-07-01' })
      .expect(200);
    const history = response.body as RatingsHistory;

    expect(history.points).toEqual([
      { date: '2026-06-23', ratingAvg: 4.4, ratingCount: 90 },
      { date: '2026-06-30', ratingAvg: 4.7, ratingCount: 120 },
    ]);
  });

  it('returns a 404 envelope for an unknown app id', async () => {
    const response = await api
      .get('/apps/missing/rank-distribution-history')
      .expect(404);

    const body = response.body as ApiErrorEnvelope;
    expect(body.statusCode).toBe(404);
    expect(body.path).toBe('/apps/missing/rank-distribution-history');
    expect(typeof body.message).toBe('string');
  });

  it('returns a 404 envelope for unknown app ratings history', async () => {
    const response = await api.get('/apps/missing/ratings-history').expect(404);

    const body = response.body as ApiErrorEnvelope;
    expect(body.statusCode).toBe(404);
    expect(body.path).toBe('/apps/missing/ratings-history');
    expect(typeof body.message).toBe('string');
  });
});
