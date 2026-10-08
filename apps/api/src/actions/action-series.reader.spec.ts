import { ActionItem, ActionRule } from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ActionSeriesReader } from './action-series.reader';

const TODAY = new Date('2026-07-30T00:00:00.000Z');

const item = (
  rule: ActionRule,
  keywordId: string | null = 'kw_1',
): ActionItem => ({
  id: 'act_1',
  rule,
  category: 'metadata',
  status: 'OPEN',
  priority: 'high',
  impact: 70,
  formulaVersion: 'actions-v1',
  scope: {
    appId: 'app_1',
    appName: 'Budget',
    store: 'APP_STORE',
    country: 'de',
    keywordId,
    keywordText: keywordId ? 'budget planner' : null,
  },
  evidence: null,
  degraded: true,
  firstSeenAt: '2026-07-25T03:00:00.000Z',
  lastSeenAt: '2026-07-29T03:00:00.000Z',
  resolvedAt: null,
  snoozedUntil: null,
  closedAt: null,
  verifiedAt: null,
  reopenCount: 0,
  note: null,
  ai: { explanation: null, model: null, generatedAt: null },
});

const buildPrisma = () => {
  const empty = jest.fn(() => Promise.resolve([]));
  return {
    keywordRanking: { findMany: jest.fn(empty) },
    trackedKeyword: { findMany: jest.fn(empty) },
    auditScore: { findMany: jest.fn(empty) },
    review: { findMany: jest.fn(empty) },
    appSnapshot: { findMany: jest.fn(empty) },
  };
};

const calls = (prisma: ReturnType<typeof buildPrisma>): number =>
  Object.values(prisma).reduce(
    (total, model) => total + model.findMany.mock.calls.length,
    0,
  );

const read = async (subject: ActionItem) => {
  const prisma = buildPrisma();
  const trend = await new ActionSeriesReader(
    prisma as unknown as PrismaService,
  ).read(subject, TODAY);
  return { prisma, trend };
};

describe('ActionSeriesReader', () => {
  it('reads the keyword positions of the app for a keyword rule', async () => {
    const { prisma, trend } = await read(item('keyword.defend'));

    expect(prisma.keywordRanking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          appId: 'app_1',
          keywordId: 'kw_1',
          date: { gte: new Date('2026-06-25T00:00:00.000Z') },
        },
      }),
    );
    expect(trend).toMatchObject({
      metric: 'position',
      direction: 'lower_is_better',
    });
    expect(trend?.points).toHaveLength(36);
    expect(calls(prisma)).toBe(1);
  });

  it('has no trend for a keyword rule without its keyword', async () => {
    const { prisma, trend } = await read(item('keyword.defend', null));

    expect(trend).toBeNull();
    expect(calls(prisma)).toBe(0);
  });

  it('reads the first overtaken keyword for a competitor overtake', async () => {
    const overtake = (keywordIds: string[]): ActionItem => ({
      ...item('competitor.investigate_overtake', null),
      degraded: false,
      evidence: {
        rule: 'competitor.investigate_overtake',
        competitorAppId: 'comp_1',
        competitorName: 'Rival',
        changedAt: '2026-07-27',
        fields: ['title'],
        newTitle: 'Rival',
        newSubtitle: null,
        keywords: keywordIds.map((keywordId) => ({
          keywordId,
          text: keywordId,
          yourBefore: 6,
          yourAfter: 9,
          theirBefore: 14,
          theirAfter: 4,
          volume: 60,
          mentioned: false,
        })),
      },
    });

    const { prisma, trend } = await read(overtake(['kw_7', 'kw_8']));
    const empty = await read(overtake([]));

    expect(prisma.keywordRanking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          appId: 'app_1',
          keywordId: 'kw_7',
          date: { gte: new Date('2026-06-25T00:00:00.000Z') },
        },
      }),
    );
    expect(trend).toMatchObject({ metric: 'position' });
    expect(empty.trend).toBeNull();
    expect(calls(empty.prisma)).toBe(0);
  });

  it('reads the store update age of the app for a stale listing', async () => {
    const { prisma, trend } = await read(item('listing.ship_update', null));

    expect(prisma.appSnapshot.findMany).toHaveBeenCalledWith({
      where: {
        appId: 'app_1',
        country: null,
        localization: null,
        capturedAt: { gte: new Date('2026-06-25T00:00:00.000Z') },
      },
      select: { capturedAt: true, storeUpdatedAt: true },
    });
    expect(trend).toMatchObject({
      metric: 'updateAge',
      direction: 'lower_is_better',
    });
    expect(calls(prisma)).toBe(1);
  });

  it('reads tracked keyword visibility for a market rule', async () => {
    const { prisma, trend } = await read(item('market.improve_country'));

    expect(prisma.trackedKeyword.findMany).toHaveBeenCalledTimes(1);
    expect(trend?.metric).toBe('visibility');
    expect(calls(prisma)).toBe(1);
  });

  it('reads the stored audit overall for an audit rule', async () => {
    const { prisma, trend } = await read(item('audit.fix_factor', null));

    expect(prisma.auditScore.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ overall: { not: null } }) as unknown,
      }),
    );
    expect(trend?.metric).toBe('audit');
    expect(calls(prisma)).toBe(1);
  });

  it('reads reviews from two weeks before the window for a review rule', async () => {
    const { prisma, trend } = await read(
      item('reviews.investigate_theme', null),
    );

    expect(prisma.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          appId: 'app_1',
          reviewedAt: { gte: new Date('2026-06-11T00:00:00.000Z') },
        },
      }),
    );
    expect(trend?.metric).toBe('rating');
    expect(calls(prisma)).toBe(1);
  });
});
