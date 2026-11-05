import { RANK_DEPTH } from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';
import { addDays, TrackedRow } from './analytics.support';
import { AnalyticsService } from './analytics.service';
import { BrandKeywords } from './brand-keywords';
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

const SCOPE = { appId: 'app', country: undefined };

const fakeBrands = (excluded: ReadonlySet<string> | null = null) => ({
  excluded: jest.fn().mockResolvedValue(excluded),
});

const sharesOf = (
  prisma: ReturnType<typeof fakePrisma>,
  brands = fakeBrands(),
) =>
  new ShareOfVoiceService(asPrisma(prisma), brands as unknown as BrandKeywords);

describe('ShareOfVoiceService.summary', () => {
  it('reads the competitor rankings of the reference day and a week before', async () => {
    const prisma = fakePrisma();
    const shares = sharesOf(prisma);

    await shares.summary(
      { competitorIds: ['rival'], excluded: null },
      { rows: [ROW], referenceDate: D0 },
    );

    const [query] = prisma.keywordRanking.findMany.mock.calls[0] as [
      { where: { date: unknown } },
    ];
    expect(query.where.date).toEqual({ in: [D0, addDays(D0, -7)] });
  });

  it('reads nothing before the app was ever checked', async () => {
    const prisma = fakePrisma();
    const shares = sharesOf(prisma);

    const { shareOfVoice } = await shares.summary(
      { competitorIds: ['rival'], excluded: null },
      {
        rows: [ROW],
        referenceDate: null,
      },
    );

    expect(prisma.keywordRanking.findMany).not.toHaveBeenCalled();
    expect(shareOfVoice?.reason).toBe('notChecked');
  });

  it('reads nothing without a competitor', async () => {
    const prisma = fakePrisma();
    const shares = sharesOf(prisma);

    const { shareOfVoice } = await shares.summary(
      { competitorIds: [], excluded: null },
      {
        rows: [ROW],
        referenceDate: D0,
      },
    );

    expect(prisma.keywordRanking.findMany).not.toHaveBeenCalled();
    expect(shareOfVoice?.reason).toBe('noCompetitors');
  });
});

describe('ShareOfVoiceService non branded share', () => {
  it('reads no keyword class without a competitor', async () => {
    const prisma = fakePrisma();
    prisma.app.findMany.mockResolvedValue([]);
    const brands = fakeBrands(new Set());

    expect(await sharesOf(prisma, brands).context(SCOPE)).toEqual({
      competitorIds: [],
      excluded: null,
    });
    expect(brands.excluded).not.toHaveBeenCalled();
  });

  it('reads the keyword classes of the market with competitors', async () => {
    const brands = fakeBrands(new Set(['k1']));

    expect(await sharesOf(fakePrisma(), brands).context(SCOPE)).toEqual({
      competitorIds: ['rival'],
      excluded: new Set(['k1']),
    });
    expect(brands.excluded).toHaveBeenCalledWith('app', undefined);
  });

  it('answers no non branded share when no class is known', async () => {
    const answer = await sharesOf(fakePrisma()).summary(
      { competitorIds: ['rival'], excluded: null },
      { rows: [ROW], referenceDate: D0 },
    );

    expect(answer).not.toHaveProperty('nonBrandedShareOfVoice');
  });

  it('measures nothing when every keyword is a brand', async () => {
    const answer = await sharesOf(fakePrisma()).summary(
      { competitorIds: ['rival'], excluded: new Set(['k1']) },
      { rows: [ROW], referenceDate: D0 },
    );

    expect(answer.nonBrandedShareOfVoice).toEqual({
      current: null,
      delta7d: null,
      competitors: 0,
      reason: 'nobodyRanks',
    });
  });
});

describe('AnalyticsService.history', () => {
  const build = () => {
    const prisma = fakePrisma();
    return {
      prisma,
      analytics: new AnalyticsService(asPrisma(prisma), sharesOf(prisma)),
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
