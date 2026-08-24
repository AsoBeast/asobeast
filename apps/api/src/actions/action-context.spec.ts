import { ConfigService } from '@nestjs/config';
import { DailyBudget, TrackedKeywordItem } from '@asobeast/shared';
import { Env } from '../config/env';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { DEFAULT_WORKSPACE_ID } from '../common/tenancy/default-workspace';
import { PrismaService } from '../prisma/prisma.service';
import { KeywordsService } from '../keywords/keywords.service';
import { MetadataService } from '../metadata/metadata.service';
import {
  ActionContextLoader,
  CONTEXT_SERP_WINDOW_DAYS,
  CONTEXT_WINDOW_DAYS,
} from './action-context';

const NOW = new Date('2026-07-30T03:00:00.000Z');
const DAY_MS = 86_400_000;

const budget: DailyBudget = {
  apps: 1,
  keywords: 10,
  categories: 0,
  reviews: 1,
  total: 12,
  capacityPerDay: 100,
  utilization: 0.12,
  stores: [],
};

const keyword = (
  keywordId: string,
  country: string,
  overrides: Partial<TrackedKeywordItem> = {},
): TrackedKeywordItem => ({
  keywordId,
  text: `phrase ${keywordId}`,
  country,
  source: 'MANUAL',
  active: true,
  latestPosition: 4,
  latestDepth: 200,
  previousPosition: 4,
  positionDelta1d: null,
  positionDelta7d: null,
  traffic: 5,
  difficulty: 4,
  volume: 50,
  relevance: 70,
  opportunity: 55,
  bucket: null,
  scoredAt: null,
  scoreProvenance: null,
  serpVolatility7d: null,
  ...overrides,
});

const APP = {
  id: 'app_1',
  name: 'Budget',
  store: 'APP_STORE' as const,
  storeAppId: '1000',
  country: 'us',
  competitors: [{ id: 'comp_1', storeAppId: '2000' }],
};

const AUDIT_ROW = {
  appId: 'app_1',
  date: new Date('2026-07-29T00:00:00.000Z'),
  overall: 61,
  coveredWeight: 85,
  totalWeight: 100,
  factors: [
    { id: 'screenshots', score: 3, weight: 15 },
    { id: 'title', score: null, weight: 20 },
    'not a factor',
  ],
};

interface PrismaStubData {
  apps?: Array<typeof APP>;
  rankings?: Array<{
    appId: string;
    keywordId: string;
    date: Date;
    position: number | null;
  }>;
  changeEvents?: Array<{ appId: string; field: string; capturedAt: Date }>;
  reviews?: Array<Record<string, unknown>>;
  auditScores?: Array<typeof AUDIT_ROW>;
  snapshots?: Array<{
    appId: string;
    version: string | null;
    capturedAt: Date;
  }>;
  serpEntries?: Array<{
    keywordId: string;
    date: Date;
    position: number;
    storeAppId: string;
    title: string;
  }>;
}

const buildPrisma = (data: PrismaStubData = {}) => ({
  app: { findMany: jest.fn(() => Promise.resolve(data.apps ?? [APP])) },
  keywordRanking: {
    findMany: jest.fn(() => Promise.resolve(data.rankings ?? [])),
  },
  changeEvent: {
    findMany: jest.fn(() => Promise.resolve(data.changeEvents ?? [])),
  },
  review: { findMany: jest.fn(() => Promise.resolve(data.reviews ?? [])) },
  auditScore: {
    findMany: jest.fn(() => Promise.resolve(data.auditScores ?? [])),
  },
  appSnapshot: {
    findMany: jest.fn(() => Promise.resolve(data.snapshots ?? [])),
  },
  serpEntry: {
    findMany: jest.fn(() => Promise.resolve(data.serpEntries ?? [])),
    findFirst: jest.fn(() => Promise.resolve(null)),
  },
});

const workspaceScope = {
  require: () => DEFAULT_WORKSPACE_ID,
} as unknown as WorkspaceContext;

const loaderFor = (
  prisma: ReturnType<typeof buildPrisma>,
  tracked: TrackedKeywordItem[] = [],
): ActionContextLoader =>
  new ActionContextLoader(
    prisma as unknown as PrismaService,
    {
      get: jest.fn((key: keyof Env) =>
        key === 'ALERT_REVIEW_SCORE_MAX' ? 2 : 5,
      ),
    } as unknown as ConfigService<Env, true>,
    {
      listTracked: jest.fn(() => Promise.resolve(tracked)),
    } as unknown as KeywordsService,
    {
      audit: jest.fn(() =>
        Promise.resolve({ coverage: [], fields: [], appId: 'app_1' }),
      ),
    } as unknown as MetadataService,
    workspaceScope,
  );

describe('ActionContextLoader', () => {
  it('returns an empty workspace without loading anything else', async () => {
    const prisma = buildPrisma({ apps: [] });

    const context = await loaderFor(prisma).load(budget, NOW);

    expect(context).toMatchObject({
      workspaceId: 'ws_default',
      apps: [],
      reviewScoreMax: 2,
      rankDropThreshold: 5,
    });
    expect(prisma.keywordRanking.findMany).not.toHaveBeenCalled();
  });

  it('loads only primary apps and keeps competitors as evidence', async () => {
    const prisma = buildPrisma();
    const context = await loaderFor(prisma, [keyword('kw_1', 'us')]).load(
      budget,
      NOW,
    );

    const appArgs = prisma.app.findMany.mock.calls[0][0] as unknown as {
      where: { isCompetitor: boolean };
    };

    expect(appArgs.where.isCompetitor).toBe(false);
    expect(context.apps.map((app) => app.id)).toEqual(['app_1']);
    expect(context.apps[0].competitorAppIdsByStoreAppId.get('2000')).toBe(
      'comp_1',
    );
    expect(context.apps[0].storeAppId).toBe('1000');
  });

  it('issues one bulk query per concern, never one per keyword', async () => {
    const prisma = buildPrisma();
    await loaderFor(prisma, [
      keyword('kw_1', 'us'),
      keyword('kw_2', 'us'),
      keyword('kw_3', 'de'),
    ]).load(budget, NOW);

    expect(prisma.keywordRanking.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.changeEvent.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.review.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.auditScore.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.appSnapshot.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.serpEntry.findMany).toHaveBeenCalledTimes(1);
  });

  it('bounds the ranking window and the shorter SERP window', async () => {
    const prisma = buildPrisma();
    await loaderFor(prisma, [keyword('kw_1', 'us')]).load(budget, NOW);

    const rankingArgs = prisma.keywordRanking.findMany.mock
      .calls[0][0] as unknown as { where: { date: { gte: Date } } };
    const serpArgs = prisma.serpEntry.findMany.mock.calls[0][0] as unknown as {
      where: { date: { gte: Date } };
    };

    expect(rankingArgs.where.date.gte).toEqual(
      new Date(NOW.getTime() - CONTEXT_WINDOW_DAYS * DAY_MS),
    );
    expect(serpArgs.where.date.gte).toEqual(
      new Date(NOW.getTime() - CONTEXT_SERP_WINDOW_DAYS * DAY_MS),
    );
  });

  it('groups tracked keywords by market', async () => {
    const context = await loaderFor(buildPrisma(), [
      keyword('kw_1', 'us'),
      keyword('kw_2', 'de'),
      keyword('kw_3', 'de'),
    ]).load(budget, NOW);

    expect([...context.apps[0].keywordsByCountry.keys()].sort()).toEqual([
      'de',
      'us',
    ]);
    expect(context.apps[0].keywordsByCountry.get('de')).toHaveLength(2);
  });

  it('builds a per-market visibility series from the stored rankings', async () => {
    const prisma = buildPrisma({
      rankings: [
        {
          appId: 'app_1',
          keywordId: 'kw_1',
          date: new Date('2026-07-29T00:00:00.000Z'),
          position: 1,
        },
        {
          appId: 'app_1',
          keywordId: 'kw_2',
          date: new Date('2026-07-29T00:00:00.000Z'),
          position: null,
        },
      ],
    });

    const context = await loaderFor(prisma, [
      keyword('kw_1', 'us'),
      keyword('kw_2', 'de'),
    ]).load(budget, NOW);

    expect(context.apps[0].visibilityByCountry.get('us')).toEqual([
      { date: '2026-07-29', visibility: 100 },
    ]);
    expect(context.apps[0].visibilityByCountry.get('de')).toEqual([
      { date: '2026-07-29', visibility: 0 },
    ]);
  });

  it('folds SERP entries into snapshot days per keyword', async () => {
    const prisma = buildPrisma({
      serpEntries: [
        {
          keywordId: 'kw_1',
          date: new Date('2026-07-29T00:00:00.000Z'),
          position: 1,
          storeAppId: '9',
          title: 'Nine',
        },
        {
          keywordId: 'kw_1',
          date: new Date('2026-07-29T00:00:00.000Z'),
          position: 2,
          storeAppId: '8',
          title: 'Eight',
        },
        {
          keywordId: 'kw_1',
          date: new Date('2026-07-28T00:00:00.000Z'),
          position: 1,
          storeAppId: '9',
          title: 'Nine',
        },
      ],
    });

    const context = await loaderFor(prisma, [keyword('kw_1', 'us')]).load(
      budget,
      NOW,
    );
    const days = context.apps[0].serpDaysByKeyword.get('kw_1');

    expect(days?.map((day) => day.date)).toEqual(['2026-07-28', '2026-07-29']);
    expect(days?.[1].entries).toHaveLength(2);
  });

  it('reads the newest audit snapshot and labels its factors', async () => {
    const context = await loaderFor(
      buildPrisma({ auditScores: [AUDIT_ROW] }),
      [],
    ).load(budget, NOW);

    expect(context.apps[0].audit).toMatchObject({
      date: '2026-07-29',
      overall: 61,
      coveredWeight: 85,
      totalWeight: 100,
    });
    expect(context.apps[0].audit?.factors).toEqual([
      {
        id: 'screenshots',
        label: 'Screenshots',
        weight: 15,
        score: 3,
        checks: [],
      },
      { id: 'title', label: 'Title', weight: 20, score: null, checks: [] },
    ]);
  });

  it('reports no audit when the stored factors are unusable', async () => {
    const context = await loaderFor(
      buildPrisma({
        auditScores: [{ ...AUDIT_ROW, factors: 'broken' as unknown as [] }],
      }),
      [],
    ).load(budget, NOW);

    expect(context.apps[0].audit).toBeNull();
  });

  it('drops change events whose field is not a known change field', async () => {
    const context = await loaderFor(
      buildPrisma({
        changeEvents: [
          { appId: 'app_1', field: 'title', capturedAt: NOW },
          { appId: 'app_1', field: 'mystery', capturedAt: NOW },
        ],
      }),
      [],
    ).load(budget, NOW);

    expect(context.apps[0].changeEvents).toEqual([
      { field: 'title', capturedAt: NOW },
    ]);
  });

  it('reads the latest and previous distinct versions from snapshots', async () => {
    const context = await loaderFor(
      buildPrisma({
        snapshots: [
          { appId: 'app_1', version: '4.2.0', capturedAt: NOW },
          { appId: 'app_1', version: '4.2.0', capturedAt: NOW },
          { appId: 'app_1', version: '4.1.0', capturedAt: NOW },
        ],
      }),
      [],
    ).load(budget, NOW);

    expect(context.apps[0].latestVersion).toBe('4.2.0');
    expect(context.apps[0].previousVersion).toBe('4.1.0');
  });

  it('reports no previous version for a first release', async () => {
    const context = await loaderFor(
      buildPrisma({
        snapshots: [{ appId: 'app_1', version: '1.0.0', capturedAt: NOW }],
      }),
      [],
    ).load(budget, NOW);

    expect(context.apps[0].latestVersion).toBe('1.0.0');
    expect(context.apps[0].previousVersion).toBeNull();
  });

  it('skips the SERP query entirely when nothing is tracked', async () => {
    const prisma = buildPrisma();

    await loaderFor(prisma, []).load(budget, NOW);

    expect(prisma.serpEntry.findMany).not.toHaveBeenCalled();
  });

  it('skips an app whose derived data vanished mid-run instead of failing', async () => {
    const prisma = buildPrisma({
      apps: [APP, { ...APP, id: 'app_2', storeAppId: '2000' }],
    });
    const loader = new ActionContextLoader(
      prisma as unknown as PrismaService,
      {
        get: jest.fn((key: keyof Env) =>
          key === 'ALERT_REVIEW_SCORE_MAX' ? 2 : 5,
        ),
      } as unknown as ConfigService<Env, true>,
      {
        listTracked: jest.fn((appId: string) =>
          appId === 'app_2'
            ? Promise.reject(new Error(`App ${appId} not found`))
            : Promise.resolve([keyword('kw_1', 'us')]),
        ),
      } as unknown as KeywordsService,
      {
        audit: jest.fn(() =>
          Promise.resolve({ coverage: [], fields: [], appId: 'app_1' }),
        ),
      } as unknown as MetadataService,
      workspaceScope,
    );

    const context = await loader.load(budget, NOW);

    expect(context.apps.map((app) => app.id)).toEqual(['app_1']);
  });

  it('returns an empty workspace when every app vanished mid-run', async () => {
    const prisma = buildPrisma();
    const loader = new ActionContextLoader(
      prisma as unknown as PrismaService,
      {
        get: jest.fn(() => 2),
      } as unknown as ConfigService<Env, true>,
      {
        listTracked: jest.fn(() => Promise.reject(new Error('App not found'))),
      } as unknown as KeywordsService,
      {
        audit: jest.fn(() =>
          Promise.resolve({ coverage: [], fields: [], appId: 'app_1' }),
        ),
      } as unknown as MetadataService,
      workspaceScope,
    );

    const context = await loader.load(budget, NOW);

    expect(context.apps).toEqual([]);
    expect(prisma.serpEntry.findMany).not.toHaveBeenCalled();
  });
});
