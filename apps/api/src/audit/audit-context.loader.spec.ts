import { ConfigService } from '@nestjs/config';
import { AnalyticsService } from '../analytics/analytics.service';
import { Env } from '../config/env';
import { KeywordsService } from '../keywords/keywords.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAiService } from './audit-ai.service';
import { AuditContextLoader } from './audit-context.loader';
import { creativeFingerprint } from './creative/creative-observations';

const D0 = new Date('2026-09-10T00:00:00.000Z');

const trackedKeyword = (text: string, country: string, active: boolean) => ({
  keywordId: text,
  text,
  country,
  source: 'MANUAL' as const,
  active,
  latestPosition: 4,
  latestDepth: 100,
  previousPosition: null,
  positionDelta1d: null,
  positionDelta7d: null,
  traffic: 7,
  difficulty: 3,
  volume: 100,
  relevance: 80,
  opportunity: 60,
  bucket: 'primary' as const,
  scoredAt: null,
  scoreProvenance: null,
  serpVolatility7d: null,
});

interface LoaderOptions {
  model?: string | null;
  insight?: Record<string, unknown> | null;
}

const buildLoader = (options: LoaderOptions = {}) => {
  const prisma = {
    app: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'app-1',
        store: 'APP_STORE',
        country: 'us',
        name: 'Habit Tracker',
      }),
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'rival',
          name: 'Rival Labs',
          store: 'APP_STORE',
          snapshots: [
            {
              title: 'Rival Quiz',
              subtitle: 'Guess the place',
              ratingAvg: 4.2,
              ratingCount: 900,
              storeUpdatedAt: D0,
              raw: { screenshots: ['a.png', 'b.png'], icon: 'i.png' },
            },
          ],
        },
      ]),
    },
    appSnapshot: {
      findFirst: jest.fn().mockResolvedValue({
        capturedAt: D0,
        title: 'Habit Tracker',
        subtitle: 'Daily Streaks',
        summary: null,
        description: 'Build habits.',
        ratingAvg: 4.6,
        ratingCount: 5000,
        storeUpdatedAt: D0,
        raw: {},
      }),
    },
    review: {
      findMany: jest
        .fn()
        .mockResolvedValue([
          { score: 1, title: null, text: 'Too many ads', reviewedAt: D0 },
        ]),
    },
    auditInsight: {
      findUnique: jest.fn().mockResolvedValue(options.insight ?? null),
    },
  } as unknown as PrismaService;
  const keywords = {
    listTracked: jest
      .fn()
      .mockResolvedValue([
        trackedKeyword('habit tracker', 'us', true),
        trackedKeyword('streak counter', 'gb', true),
        trackedKeyword('daily goals', 'us', false),
      ]),
    compare: jest.fn().mockResolvedValue({ competitors: [], rows: [] }),
    getKeywordField: jest
      .fn()
      .mockResolvedValue({ tracked: [{ text: 'habit' }, { text: 'streak' }] }),
  } as unknown as KeywordsService;
  const model = options.model === undefined ? 'gpt-5.6-luna' : options.model;
  const auditAi = {
    configured: model !== null,
    model,
  } as unknown as AuditAiService;
  const analytics = {
    history: jest.fn().mockResolvedValue({
      points: [
        { date: '2026-09-01', visibility: 30 },
        { date: '2026-09-10', visibility: 42 },
      ],
    }),
  } as unknown as AnalyticsService;
  const config = {
    get: jest.fn().mockReturnValue(2),
  } as unknown as ConfigService<Env, true>;

  return new AuditContextLoader(prisma, keywords, auditAi, analytics, config);
};

describe('AuditContextLoader.load', () => {
  it('keeps only the active keywords of the home storefront', async () => {
    const context = await buildLoader().load('app-1');

    expect(context.keywords.map((item) => item.text)).toEqual([
      'habit tracker',
    ]);
    expect(context.keywords[0]).toMatchObject({
      traffic: 7,
      volume: 100,
      opportunity: 60,
    });
  });

  it('maps each competitor from its latest snapshot', async () => {
    const context = await buildLoader().load('app-1');

    expect(context.competitors).toEqual([
      {
        id: 'rival',
        name: 'Rival Labs',
        title: 'Rival Quiz',
        subtitle: 'Guess the place',
        ratingAvg: 4.2,
        ratingCount: 900,
        screenshotCount: 2,
        hasVideo: false,
        iconUrl: 'i.png',
        storeUpdatedAt: D0,
      },
    ]);
  });

  it('carries the review window and the negative review threshold', async () => {
    const context = await buildLoader().load('app-1');

    expect(context.reviews).toEqual([
      { score: 1, title: null, text: 'Too many ads', reviewedAt: D0 },
    ]);
    expect(context.reviewScoreMax).toBe(2);
  });

  it('joins the saved keyword field in paste order', async () => {
    const context = await buildLoader().load('app-1');

    expect(context.keywordField).toBe('habit,streak');
  });

  it('reads the latest visibility point and the one a week before it', async () => {
    const context = await buildLoader().load('app-1');

    expect(context.visibility).toEqual({
      latest: 42,
      latestDate: '2026-09-10',
      weekAgo: 30,
    });
  });
});

describe('AuditContextLoader creative staleness', () => {
  const ANALYZED_WITH = 'gpt-5.6-luna';

  const analyzedInsight = (inputHash: string) => ({
    observations: { icon: null, screenshots: [], consistentStyle: null },
    inputHash,
    generatedAt: D0,
    model: ANALYZED_WITH,
    runState: 'completed',
    runError: null,
    requestedAt: D0,
  });

  it('flags changed creative as stale when no model is configured', async () => {
    const loader = buildLoader({
      model: null,
      insight: analyzedInsight('fingerprint-of-older-creative'),
    });

    const context = await loader.load('app-1');

    expect(context.creative.stale).toBe(true);
  });

  it('keeps unchanged creative current when no model is configured', async () => {
    const inputs = await buildLoader().creativeInputs('app-1');
    const loader = buildLoader({
      model: null,
      insight: analyzedInsight(creativeFingerprint(inputs, ANALYZED_WITH)),
    });

    const context = await loader.load('app-1');

    expect(context.creative.stale).toBe(false);
  });
});
