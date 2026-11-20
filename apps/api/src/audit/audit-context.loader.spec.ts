import type { AiProvider } from '@asobeast/shared';
import { ConfigService } from '@nestjs/config';
import { AnalyticsService } from '../analytics/analytics.service';
import { Env } from '../config/env';
import { KeywordFieldService } from '../keywords/keyword-field.service';
import { KeywordsService } from '../keywords/keywords.service';
import { PrismaService } from '../prisma/prisma.service';
import { ScreenshotsService } from '../screenshots/screenshots.service';
import { AuditAiService } from './audit-ai.service';
import {
  AuditContextLoader,
  FEATURING_FRESH_DAYS,
} from './audit-context.loader';
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
  provider?: AiProvider;
  insight?: Record<string, unknown> | null;
  store?: 'APP_STORE' | 'GOOGLE_PLAY';
  screenshots?: Array<{ status: string; caption: string | null }>;
  forApp?: jest.Mock;
  snapshotFindFirst?: jest.Mock;
  featuringRow?: Record<string, unknown> | null;
  connectionStatus?: 'active' | 'rejected' | null;
}

const featuringRowOf = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  appId: 'app-1',
  draftNominations: 1,
  submittedNominations: 1,
  submittedDate: new Date('2026-10-05T09:30:00.000Z'),
  publishStartDate: new Date('2026-11-19T00:00:00.000Z'),
  publishEndDate: new Date('2026-12-19T00:00:00.000Z'),
  promoFilled: 2,
  promoTotal: 3,
  roleRefused: false,
  nominationsError: null,
  promoError: null,
  readAt: new Date(Date.now() - 60 * 60 * 1000),
  ...overrides,
});

const buildLoader = (options: LoaderOptions = {}) => {
  const prisma = {
    featuringSync: {
      findFirst: jest.fn().mockResolvedValue(options.featuringRow ?? null),
    },
    storeConnection: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          options.connectionStatus === undefined
            ? { status: 'active' }
            : options.connectionStatus === null
              ? null
              : { status: options.connectionStatus },
        ),
    },
    app: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'app-1',
        store: options.store ?? 'APP_STORE',
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
      findFirst:
        options.snapshotFindFirst ??
        jest.fn().mockResolvedValue({
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
  } as unknown as KeywordsService;
  const keywordFields = {
    getKeywordField: jest.fn().mockResolvedValue({
      tracked: [{ text: 'habit' }],
      phrases: ['habit', 'streak'],
    }),
  } as unknown as KeywordFieldService;
  const model = options.model === undefined ? 'gpt-5.6-luna' : options.model;
  const auditAi = {
    configured: model !== null,
    model,
    provider: model === null ? null : (options.provider ?? 'openai'),
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

  const forApp =
    options.forApp ??
    jest.fn().mockResolvedValue({ screenshots: options.screenshots ?? [] });
  const loader = new AuditContextLoader(
    prisma,
    keywords,
    keywordFields,
    auditAi,
    analytics,
    config,
    { forApp } as unknown as ScreenshotsService,
  );
  return { loader, prisma };
};

describe('AuditContextLoader.load', () => {
  it('reports the provider the next analysis would send image links to', async () => {
    const { loader } = buildLoader({ provider: 'compatible' });
    const context = await loader.load('app-1');

    expect(context.aiStatus.provider).toBe('compatible');
  });

  it('reports no provider when AI is not configured', async () => {
    const { loader } = buildLoader({ model: null });
    const context = await loader.load('app-1');

    expect(context.aiStatus.provider).toBeNull();
  });

  it('keeps only the active keywords of the home storefront', async () => {
    const { loader } = buildLoader();
    const context = await loader.load('app-1');

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
    const { loader } = buildLoader();
    const context = await loader.load('app-1');

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
    const { loader } = buildLoader();
    const context = await loader.load('app-1');

    expect(context.reviews).toEqual([
      { score: 1, title: null, text: 'Too many ads', reviewedAt: D0 },
    ]);
    expect(context.reviewScoreMax).toBe(2);
  });

  it('judges the saved keyword field, untracked phrases included', async () => {
    const { loader } = buildLoader();
    const context = await loader.load('app-1');

    expect(context.keywordField).toBe('habit,streak');
  });

  it('reads the latest visibility point and the one a week before it', async () => {
    const { loader } = buildLoader();
    const context = await loader.load('app-1');

    expect(context.visibility).toEqual({
      latest: 42,
      latestDate: '2026-09-10',
      weekAgo: 30,
    });
  });

  it('answers the extract from the latest snapshot when it carries one', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      capturedAt: D0,
      title: 'Habit Tracker',
      subtitle: 'Daily Streaks',
      summary: null,
      description: 'Build habits.',
      ratingAvg: 4.6,
      ratingCount: 5000,
      storeUpdatedAt: D0,
      raw: { pageExtract: { previewVideoUrls: ['v.mp4'] } },
    });
    const { loader } = buildLoader({ snapshotFindFirst: findFirst });
    const context = await loader.load('app-1');

    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(context.extract?.facts.previewVideoUrls).toEqual(['v.mp4']);
    expect(context.extract?.asOf).toBe('2026-09-10');
    expect(context.extract?.fallback).toBe(false);
  });

  it('falls back to the newest snapshot with an extract in a second query', async () => {
    const findFirst = jest
      .fn()
      .mockResolvedValueOnce({
        capturedAt: D0,
        title: 'Habit Tracker',
        subtitle: 'Daily Streaks',
        summary: null,
        description: 'Build habits.',
        ratingAvg: 4.6,
        ratingCount: 5000,
        storeUpdatedAt: D0,
        raw: {},
      })
      .mockResolvedValueOnce({
        capturedAt: D0,
        raw: { pageExtract: { featuredStories: [{ storyId: 's1' }] } },
      });
    const { loader } = buildLoader({ snapshotFindFirst: findFirst });
    const context = await loader.load('app-1');

    expect(findFirst).toHaveBeenCalledTimes(2);
    expect(context.extract?.facts.featuredStories).toHaveLength(1);
    expect(context.extract?.fallback).toBe(true);
  });

  it('scans no snapshot for an extract on google play', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      capturedAt: D0,
      title: 'Habit Tracker',
      summary: null,
      description: 'Build habits.',
      ratingAvg: 4.6,
      ratingCount: 5000,
      storeUpdatedAt: D0,
      raw: {},
    });
    const { loader } = buildLoader({
      store: 'GOOGLE_PLAY',
      snapshotFindFirst: findFirst,
    });
    const context = await loader.load('app-1');

    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(context.extract).toBeNull();
  });
});

describe('AuditContextLoader featuring reads', () => {
  it('reads the stored featuring row only for an app store app', async () => {
    const appStore = buildLoader();
    await appStore.loader.load('app-1');
    expect(appStore.prisma.featuringSync.findFirst).toHaveBeenCalledTimes(1);
    expect(appStore.prisma.storeConnection.findFirst).toHaveBeenCalledTimes(1);

    const play = buildLoader({ store: 'GOOGLE_PLAY' });
    await play.loader.load('app-1');
    expect(play.prisma.featuringSync.findFirst).not.toHaveBeenCalled();
    expect(play.prisma.storeConnection.findFirst).not.toHaveBeenCalled();
  });

  it('answers the stored featuring row while the read is fresh', async () => {
    const { loader } = buildLoader({ featuringRow: featuringRowOf() });
    const context = await loader.load('app-1');

    expect(context.featuring).toMatchObject({
      draftNominations: 1,
      submittedNominations: 1,
      submittedDate: new Date('2026-10-05T09:30:00.000Z'),
      publishStartDate: new Date('2026-11-19T00:00:00.000Z'),
      publishEndDate: new Date('2026-12-19T00:00:00.000Z'),
      promoFilled: 2,
      promoTotal: 3,
      roleRefused: false,
      nominationsError: null,
      promoError: null,
    });
  });

  it('answers no featuring reads when the connection was rejected', async () => {
    const { loader, prisma } = buildLoader({
      featuringRow: featuringRowOf(),
      connectionStatus: 'rejected',
    });
    const context = await loader.load('app-1');

    expect(context.featuring).toBeNull();
    expect(prisma.featuringSync.findFirst).not.toHaveBeenCalled();
  });

  it('answers no featuring reads while no connection exists', async () => {
    const { loader, prisma } = buildLoader({
      featuringRow: featuringRowOf(),
      connectionStatus: null,
    });
    const context = await loader.load('app-1');

    expect(context.featuring).toBeNull();
    expect(prisma.featuringSync.findFirst).not.toHaveBeenCalled();
  });

  it('answers no featuring reads once the read grew older than three days', async () => {
    const stale = featuringRowOf({
      readAt: new Date(
        Date.now() - (FEATURING_FRESH_DAYS * 24 * 60 * 60 * 1000 + 60_000),
      ),
    });
    const { loader } = buildLoader({ featuringRow: stale });
    const context = await loader.load('app-1');

    expect(context.featuring).toBeNull();
  });

  it('answers no featuring reads while the read never settled', async () => {
    const { loader } = buildLoader({
      featuringRow: featuringRowOf({ readAt: null }),
    });
    const context = await loader.load('app-1');

    expect(context.featuring).toBeNull();
  });
});

describe('AuditContextLoader creative staleness', () => {
  const ANALYZED_WITH = 'gpt-5.6-luna';

  const analyzedInsight = (inputHash: string) => ({
    observations: {
      icon: null,
      screenshots: [],
      consistentStyle: null,
      media: { iconUrl: null, screenshotUrls: [], competitorAppIds: [] },
    },
    inputHash,
    generatedAt: D0,
    model: ANALYZED_WITH,
    runState: 'completed',
    runError: null,
    requestedAt: D0,
  });

  it('flags changed creative as stale when no model is configured', async () => {
    const { loader } = buildLoader({
      model: null,
      insight: analyzedInsight('fingerprint-of-older-creative'),
    });

    const context = await loader.load('app-1');

    expect(context.creative.stale).toBe(true);
  });

  it('keeps unchanged creative current when no model is configured', async () => {
    const built = buildLoader();
    const inputs = await built.loader.creativeInputs('app-1');
    const { loader } = buildLoader({
      model: null,
      insight: analyzedInsight(creativeFingerprint(inputs, ANALYZED_WITH)),
    });

    const context = await loader.load('app-1');

    expect(context.creative.stale).toBe(false);
  });
});

describe('AuditContextLoader screenshot captions', () => {
  it('loads the captions read from the latest snapshot of an app store app', async () => {
    const { loader } = buildLoader({
      screenshots: [
        { status: 'read', caption: 'Track habits' },
        { status: 'blank', caption: null },
        { status: 'read', caption: 'Build streaks' },
      ],
    });

    const context = await loader.load('app-1');

    expect(context.screenshotCaptions).toEqual([
      'Track habits',
      'Build streaks',
    ]);
  });

  it('loads null while nothing has settled', async () => {
    const { loader } = buildLoader({
      screenshots: [
        { status: 'pending', caption: null },
        { status: 'failed', caption: null },
      ],
    });

    const context = await loader.load('app-1');

    expect(context.screenshotCaptions).toBeNull();
  });

  it('does not ask for captions on google play', async () => {
    const forApp = jest.fn();
    const { loader } = buildLoader({ store: 'GOOGLE_PLAY', forApp });

    const context = await loader.load('app-1');

    expect(forApp).not.toHaveBeenCalled();
    expect(context.screenshotCaptions).toBeNull();
  });
});
