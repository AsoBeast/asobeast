import { RANK_DEPTH } from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';
import { addDays, TrackedRow } from './analytics.support';
import { AnalyticsService } from './analytics.service';
import { ShareOfVoiceService } from './share-of-voice.service';

const D0 = new Date('2026-11-03T00:00:00Z');

const ROW: TrackedRow = {
  keywordId: 'k1',
  source: 'MANUAL',
  relevance: null,
  keyword: {
    text: 'habit tracker',
    country: 'us',
    metrics: [{ traffic: 5, difficulty: 3, date: D0 }],
    rankings: [{ date: D0, position: 3, depth: RANK_DEPTH }],
  },
};

const fakePrisma = () => ({
  app: {
    findFirst: jest.fn().mockResolvedValue({ id: 'app' }),
    findMany: jest.fn().mockResolvedValue([{ id: 'rival' }]),
  },
  trackedKeyword: { findMany: jest.fn().mockResolvedValue([ROW]) },
  keywordRanking: { findMany: jest.fn().mockResolvedValue([]) },
});

const asPrisma = (prisma: ReturnType<typeof fakePrisma>) =>
  prisma as unknown as PrismaService;

describe('ShareOfVoiceService.summary', () => {
  it('reads the competitor rankings of the reference day and a week before', async () => {
    const prisma = fakePrisma();
    const shares = new ShareOfVoiceService(asPrisma(prisma));

    await shares.summary(['rival'], { rows: [ROW], referenceDate: D0 });

    const [query] = prisma.keywordRanking.findMany.mock.calls[0] as [
      { where: { date: unknown } },
    ];
    expect(query.where.date).toEqual({ in: [D0, addDays(D0, -7)] });
  });

  it('reads nothing before the app was ever checked', async () => {
    const prisma = fakePrisma();
    const shares = new ShareOfVoiceService(asPrisma(prisma));

    const { shareOfVoice } = await shares.summary(['rival'], {
      rows: [ROW],
      referenceDate: null,
    });

    expect(prisma.keywordRanking.findMany).not.toHaveBeenCalled();
    expect(shareOfVoice?.reason).toBe('notChecked');
  });

  it('reads nothing without a competitor', async () => {
    const prisma = fakePrisma();
    const shares = new ShareOfVoiceService(asPrisma(prisma));

    const { shareOfVoice } = await shares.summary([], {
      rows: [ROW],
      referenceDate: D0,
    });

    expect(prisma.keywordRanking.findMany).not.toHaveBeenCalled();
    expect(shareOfVoice?.reason).toBe('noCompetitors');
  });
});

describe('AnalyticsService.history', () => {
  const build = () => {
    const prisma = fakePrisma();
    const shares = new ShareOfVoiceService(asPrisma(prisma));
    return {
      prisma,
      analytics: new AnalyticsService(asPrisma(prisma), shares),
    };
  };

  it('reads no competitor without a comparison', async () => {
    const { prisma, analytics } = build();

    const history = await analytics.history('app', {
      from: '2026-10-20',
      to: '2026-11-03',
    });

    expect(history).toEqual({
      points: [{ date: '2026-11-03', visibility: 50 }],
    });
    expect(prisma.app.findMany).not.toHaveBeenCalled();
    expect(prisma.keywordRanking.findMany).not.toHaveBeenCalled();
  });

  it('reads the competitor rankings of the range when compared', async () => {
    const { prisma, analytics } = build();

    await analytics.history('app', {
      from: '2026-10-20',
      to: '2026-11-03',
      compare: 'competitors',
    });

    const [query] = prisma.keywordRanking.findMany.mock.calls[0] as [
      { where: { date: unknown } },
    ];
    expect(query.where.date).toEqual({
      gte: new Date('2026-10-20T00:00:00Z'),
      lte: D0,
    });
  });
});
