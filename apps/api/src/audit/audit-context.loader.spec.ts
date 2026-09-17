import { ConfigService } from '@nestjs/config';
import { Env } from '../config/env';
import { KeywordsService } from '../keywords/keywords.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAiService } from './audit-ai.service';
import { AuditContextLoader } from './audit-context.loader';

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

const buildLoader = () => {
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
    auditInsight: { findUnique: jest.fn().mockResolvedValue(null) },
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
  const auditAi = {
    configured: true,
    model: 'gpt-5.6-luna',
  } as unknown as AuditAiService;
  const config = {
    get: jest.fn().mockReturnValue(2),
  } as unknown as ConfigService<Env, true>;

  return new AuditContextLoader(prisma, keywords, auditAi, config);
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
});
