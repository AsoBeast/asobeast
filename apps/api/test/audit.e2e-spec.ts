import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import { AppAuditResult, AuditHistory } from '@asobeast/shared';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { testDb } from './helpers/test-db';
import { ownerAgent, useCookies } from './helpers/session';
import { AiClient, OPENAI_CLIENT } from '../src/ai/openai.client';

import { obliterateQueues } from './obliterate-queues';
import { asWorkspace } from './helpers/tenancy';
import { AuditService } from '../src/audit/audit.service';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';

const D0 = new Date('2026-07-01T00:00:00.000Z');

const factor = (result: AppAuditResult, id: string) =>
  result.factors.find((item) => item.id === id);

const AI_RESPONSE = {
  icon: {
    hasText: false,
    elementCount: 'one',
    contrast: 'high',
    similarCompetitorPosition: null,
  },
  screenshots: [
    'Habit tracker streaks',
    'Streak counter daily',
    'Build one habit',
    'See your progress',
    'Gentle reminders',
    'Weekly recap',
  ].map((captionText, index) => ({
    position: index + 1,
    captionText,
    captionReadable: true,
    captionLanguage: 'en',
    message: 'benefit',
  })),
  consistentStyle: true,
};

const fakeAiClient: AiClient = {
  model: 'gpt-4o',
  structured: jest.fn().mockResolvedValue(AI_RESPONSE),
};

describe('AuditController (e2e)', () => {
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
      .overrideProvider(OPENAI_CLIENT)
      .useValue(fakeAiClient)
      .compile();

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
    const created = await prisma.app.create({
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
        appId: created.id,
        title: 'Habit Tracker',
        subtitle: 'Daily Streak Counter',
        description:
          'Build better habits every single day.\n- Loved by 1 million users. Download now to start today.',
        ratingAvg: 4.6,
        ratingCount: 5000,
        storeUpdatedAt: new Date(),
        raw: {
          icon: 'https://cdn.example.com/icon.png',
          screenshots: Array.from({ length: 8 }, (_, i) => `s${i}.png`),
          releaseNotes: 'Bug fixes and improvements.',
        },
        capturedAt: D0,
      },
    });

    const keywords = [
      { text: 'habit tracker', traffic: 8, difficulty: 3, position: 4 },
      { text: 'streak counter', traffic: 6, difficulty: 4, position: 12 },
      { text: 'daily goals', traffic: 7, difficulty: 2, position: null },
    ];
    for (const kw of keywords) {
      const keyword = await prisma.keyword.create({
        data: { text: kw.text, store: Store.APP_STORE, country: 'us' },
      });
      await prisma.trackedKeyword.create({
        data: {
          appId: created.id,
          keywordId: keyword.id,
          source: 'MANUAL',
          active: true,
        },
      });
      await prisma.keywordMetric.create({
        data: {
          keywordId: keyword.id,
          date: D0,
          traffic: kw.traffic,
          difficulty: kw.difficulty,
        },
      });
      await prisma.keywordRanking.create({
        data: {
          appId: created.id,
          workspaceId: DEFAULT_WORKSPACE_ID,
          keywordId: keyword.id,
          date: D0,
          position: kw.position,
          depth: 100,
        },
      });
    }

    return created.id;
  };

  it('returns the ten factor score card with ported weights', async () => {
    const id = await seed();

    const response = await api.get(`/apps/${id}/audit`).expect(200);
    const result = response.body as AppAuditResult;

    expect(result.factors).toHaveLength(10);
    expect(factor(result, 'title')?.weight).toBe(20);
    expect(result.totalWeight).toBe(110);
    expect(result.overall).not.toBeNull();
    expect(result.ai.configured).toBe(true);
    expect(result.ai.generatedAt).toBeNull();

    const ratings = factor(result, 'ratings');
    expect(ratings?.score).toBeCloseTo(8.2, 1);

    expect(factor(result, 'keywordField')?.needsInput).toBe(true);
    expect(factor(result, 'keywordField')?.score).toBeNull();
    expect(factor(result, 'keywordField')?.availability).toBe('awaiting-input');
  });

  const seedCompetitor = (
    appId: string,
    storeAppId: string,
    name: string,
    title: string,
    ratingCount: number,
  ) =>
    prisma.app
      .create({
        data: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          store: Store.APP_STORE,
          storeAppId,
          country: 'us',
          name,
          isCompetitor: true,
          primaryAppId: appId,
        },
      })
      .then((competitor) =>
        prisma.appSnapshot.create({
          data: {
            appId: competitor.id,
            title,
            description: 'A rival listing.',
            ratingAvg: 4.3,
            ratingCount,
            raw: { screenshots: ['a.png'] },
            capturedAt: D0,
          },
        }),
      );

  it('leaves the competitor checks unanswered without competitors', async () => {
    const id = await seed();

    const result = (await api.get(`/apps/${id}/audit`).expect(200))
      .body as AppAuditResult;
    const uniqueness = factor(result, 'title')?.checks.find(
      (item) => item.id === 'title-uniqueness',
    );

    expect(uniqueness).toMatchObject({
      score: null,
      status: 'unanswered',
      unlock: { kind: 'competitors' },
    });
  });

  it('benchmarks the rating volume once two competitors carry counts', async () => {
    const id = await seed();
    await seedCompetitor(id, '1111111111', 'Rival One', 'Rival One', 1000);
    await seedCompetitor(id, '2222222222', 'Rival Two', 'Rival Two', 3000);

    const result = (await api.get(`/apps/${id}/audit`).expect(200))
      .body as AppAuditResult;
    const volume = factor(result, 'ratings')?.checks.find(
      (item) => item.id === 'ratings-volume',
    );

    expect(volume).toMatchObject({ source: 'competitors', score: 10 });
    expect(volume?.detail).toBe(
      'You have 5000 ratings; the median competitor has 2000.',
    );
    expect(result.benchmarks?.competitors).toBe(2);
    expect(
      result.benchmarks?.rows.find((row) => row.metric === 'rating-count'),
    ).toMatchObject({ you: 5000, median: 2000, best: 3000 });
  });

  it('reports no benchmarks without competitors', async () => {
    const id = await seed();

    const result = (await api.get(`/apps/${id}/audit`).expect(200))
      .body as AppAuditResult;

    expect(result.benchmarks).toBeNull();
  });

  it('carries a fix, an effort, an impact, a lift and a target on every recommendation', async () => {
    const id = await seed();

    const result = (await api.get(`/apps/${id}/audit`).expect(200))
      .body as AppAuditResult;
    const all = [
      ...result.recommendations.quickWins,
      ...result.recommendations.highImpact,
      ...result.recommendations.strategic,
    ];

    expect(all.length).toBeGreaterThan(0);
    expect(
      all.every(
        (item) =>
          typeof item.fix === 'string' &&
          item.effort !== undefined &&
          item.impact !== undefined &&
          typeof item.lift === 'number' &&
          item.target !== undefined,
      ),
    ).toBe(true);
    expect(result.potential).not.toBeNull();
    expect(result.potential as number).toBeGreaterThanOrEqual(
      result.overall as number,
    );
  });

  it('reports the rubric version, grade, confidence and groups', async () => {
    const id = await seed();

    const response = await api.get(`/apps/${id}/audit`).expect(200);
    const result = response.body as AppAuditResult;

    expect(result.rubricVersion).toBe('v2');
    expect(result.grade).not.toBeNull();
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.groups?.map((group) => group.id)).toEqual([
      'discoverability',
      'conversion',
    ]);
    expect(
      result.factors.every(
        (item) =>
          typeof item.confidence === 'number' &&
          item.availability !== undefined,
      ),
    ).toBe(true);
    expect(result.limitations?.map((item) => item.id)).toContain(
      'preview-video',
    );
    expect(result.unlocks?.map((item) => item.kind)).toContain('ai-analysis');
  });

  it('keeps every check status inside the published union', async () => {
    const id = await seed();

    const response = await api.get(`/apps/${id}/audit`).expect(200);
    const result = response.body as AppAuditResult;
    const statuses = result.factors.flatMap((item) =>
      item.checks.map((entry) => entry.status),
    );

    expect(statuses.length).toBeGreaterThan(0);
    expect(
      statuses.every((status) =>
        ['pass', 'warn', 'fail', 'unanswered'].includes(status),
      ),
    ).toBe(true);
  });

  it('runs the AI audit, caches it, and raises the overall', async () => {
    const id = await seed();

    const before = (await api.get(`/apps/${id}/audit`).expect(200))
      .body as AppAuditResult;
    expect(factor(before, 'icon')?.needsInput).toBe(true);

    const after = (await api.post(`/apps/${id}/audit/ai`).expect(201))
      .body as AppAuditResult;

    expect(factor(after, 'previewVideo')?.availability).toBe('not-measurable');
    expect(factor(after, 'icon')?.score).toBe(10);
    expect((after.overall as number) > (before.overall as number)).toBe(true);
    expect(after.ai.model).toBe('gpt-4o');
    expect(after.ai.generatedAt).not.toBeNull();
    expect(after.creative?.screenshots).toHaveLength(6);
    expect(after.creative?.screenshots[0].keywordHits).toContain(
      'habit tracker',
    );
    expect(after.creative?.stale).toBe(false);
    expect(
      factor(after, 'screenshots')?.checks.find(
        (item) => item.id === 'screenshots-caption-keywords',
      )?.score,
    ).not.toBeNull();

    const reloaded = (await api.get(`/apps/${id}/audit`).expect(200))
      .body as AppAuditResult;
    expect(factor(reloaded, 'icon')?.score).toBe(10);
    expect(reloaded.ai.generatedAt).not.toBeNull();
    expect(reloaded.creative?.screenshots).toHaveLength(6);
  });

  it('records the audit score of the day the legacy run completes', async () => {
    const id = await seed();

    await api.post(`/apps/${id}/audit/ai`).expect(201);

    const rows = await prisma.auditScore.findMany({ where: { appId: id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].rubricVersion).toBe('v2');
  });

  it('returns 404 when running the AI audit for an unknown app', async () => {
    await api.post('/apps/missing/audit/ai').expect(404);
  });

  it('returns 404 for an unknown app', async () => {
    await api.get('/apps/missing/audit').expect(404);
  });

  it('audits a Google Play app without subtitle or keyword-field factors', async () => {
    const gplay = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.GOOGLE_PLAY,
        storeAppId: 'com.example.app',
        country: 'us',
        name: 'Play App',
      },
    });
    await prisma.appSnapshot.create({
      data: {
        appId: gplay.id,
        title: 'Play App',
        summary: 'Track daily habits and reach your goals',
        description:
          'Build better habits every single day.\n- Loved by 1 million users. Download now to start today.',
        ratingAvg: 4.4,
        ratingCount: 3000,
        installs: 500000n,
        raw: {
          genreId: 'TOOLS',
          headerImage: 'https://play-lh.googleusercontent.com/header',
          video: 'https://play.google.com/video/x',
          screenshots: Array.from({ length: 24 }, (_, i) => `p${i}.png`),
        },
        capturedAt: D0,
      },
    });

    const response = await api.get(`/apps/${gplay.id}/audit`).expect(200);
    const result = response.body as AppAuditResult;

    expect(result.store).toBe('GOOGLE_PLAY');
    expect(factor(result, 'subtitle')).toBeUndefined();
    expect(factor(result, 'keywordField')).toBeUndefined();
    expect(factor(result, 'description')?.weight).toBe(15);
    expect(result.totalWeight).toBe(105);

    const shortDescription = factor(result, 'shortDescription');
    expect(shortDescription?.weight).toBe(15);
    expect(shortDescription?.score).not.toBeNull();
    expect(factor(result, 'screenshots')?.label).toBe(
      'Screenshots and feature graphic',
    );
    const screenshots = factor(result, 'screenshots')?.checks.find(
      (item) => item.id === 'screenshots-count',
    );
    expect(screenshots?.score).toBe(10);
    expect(screenshots?.detail).toContain('across device types');
    expect(
      factor(result, 'previewVideo')?.checks.map((item) => item.id),
    ).toEqual(['preview-video-present']);
  });

  it('snapshots one audit score row per primary app, skipping competitors', async () => {
    const id = await seed();
    await prisma.app.create({
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

    const saved = await asWorkspace(app, () =>
      app.get(AuditService).snapshotAll(),
    );

    expect(saved).toBe(1);
    const rows = await prisma.auditScore.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].appId).toBe(id);
    expect(rows[0].coveredWeight).toBeGreaterThan(0);
    expect(rows[0].totalWeight).toBe(110);
    expect(Array.isArray(rows[0].factors)).toBe(true);
    expect(rows[0].rubricVersion).toBe('v2');
    expect(rows[0].confidence).toBeGreaterThan(0);
  });

  it('upserts the same day idempotently', async () => {
    const id = await seed();

    await asWorkspace(app, () => app.get(AuditService).snapshotAll());
    await asWorkspace(app, () => app.get(AuditService).snapshotAll());

    const rows = await prisma.auditScore.findMany({ where: { appId: id } });
    expect(rows).toHaveLength(1);
  });

  const seedScore = (
    appId: string,
    date: string,
    overall: number | null,
  ): Promise<unknown> =>
    prisma.auditScore.create({
      data: {
        appId,
        date: new Date(date),
        overall,
        coveredWeight: 80,
        totalWeight: 110,
        factors: [{ id: 'title', score: overall, weight: 20 }],
      },
    });

  it('returns an empty history for an app with no snapshots', async () => {
    const id = await seed();

    const response = await api.get(`/apps/${id}/audit/history`).expect(200);

    expect(response.body).toEqual({ points: [] });
  });

  it('windows the history and serializes null overall points', async () => {
    const id = await seed();
    await seedScore(id, '2026-06-01', 70);
    await seedScore(id, '2026-06-15', null);
    await seedScore(id, '2026-07-01', 76);

    const response = await api
      .get(`/apps/${id}/audit/history`)
      .query({ from: '2026-06-10', to: '2026-07-05' })
      .expect(200);
    const body = response.body as AuditHistory;

    expect(body.points.map((point) => point.date)).toEqual([
      '2026-06-15',
      '2026-07-01',
    ]);
    expect(body.points[0].overall).toBeNull();
    expect(body.points[0].coveredWeight).toBe(80);
    expect(body.points[1].overall).toBe(76);
  });

  it('normalizes timestamped bounds to the UTC day so boundary points are kept', async () => {
    const id = await seed();
    await seedScore(id, '2026-06-15', 72);

    const response = await api
      .get(`/apps/${id}/audit/history`)
      .query({
        from: '2026-06-15T18:00:00.000Z',
        to: '2026-06-15T06:00:00.000Z',
      })
      .expect(200);
    const body = response.body as AuditHistory;

    expect(body.points.map((point) => point.date)).toEqual(['2026-06-15']);
  });

  it.each([
    ['a start that is not on the calendar', { from: '2026-09-31' }],
    ['an end before the start', { from: '2026-09-15', to: '2026-09-01' }],
  ])('refuses a history window with %s', async (_case, query) => {
    const id = await seed();

    await api.get(`/apps/${id}/audit/history`).query(query).expect(400);
  });

  it('returns 404 history for an unknown app', async () => {
    await api.get('/apps/missing/audit/history').expect(404);
  });
});

describe('AuditController without an AI key (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(OPENAI_CLIENT)
      .useValue(null)
      .compile();

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

  afterAll(async () => {
    await obliterateQueues(app);
    await app.close();
  });

  it('reports the audit unconfigured and 409s the run endpoint', async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    );
    const created = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '5555555555',
        country: 'us',
        name: 'No Key App',
      },
    });

    const audit = (await api.get(`/apps/${created.id}/audit`).expect(200))
      .body as AppAuditResult;
    expect(audit.ai.configured).toBe(false);
    expect(audit.ai.model).toBeNull();

    await api.post(`/apps/${created.id}/audit/ai`).expect(409);
  });
});
