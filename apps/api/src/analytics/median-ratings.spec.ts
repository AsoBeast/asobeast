import { PrismaService } from '../prisma/prisma.service';
import { medianRatingsAt, TrackedRow } from './analytics.support';

const REFERENCE = new Date('2026-09-20T00:00:00Z');

const row = (keywordId: string, dates: string[]): TrackedRow => ({
  keywordId,
  source: 'MANUAL',
  fieldOrder: null,
  relevance: null,
  keyword: {
    text: keywordId,
    rankings: [],
    metrics: dates.map((date) => ({
      traffic: 5,
      difficulty: 5,
      date: new Date(`${date}T00:00:00Z`),
    })),
  },
});

const signals = (medianRatingCount: number) => ({
  signals: {
    suggestReach: 'hit',
    suggestPrefixLength: 2,
    suggestPosition: 1,
    serpRelevance: 1,
    medianRatingCount,
    flags: [],
    officialPopularity: null,
    estimatedTraffic: 5,
  },
});

describe('medianRatingsAt', () => {
  it('reads only the metric in effect on the reference day, in the home market', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValue([{ keywordId: 'quiz', stats: signals(21_500) }]);
    const prisma = { keywordMetric: { findMany } } as unknown as PrismaService;

    const medians = await medianRatingsAt(
      prisma,
      [row('quiz', ['2026-09-27', '2026-09-13', '2026-09-06']), row('new', [])],
      REFERENCE,
      'us',
    );

    expect(findMany).toHaveBeenCalledWith({
      where: {
        OR: [{ keywordId: 'quiz', date: new Date('2026-09-13T00:00:00Z') }],
        keyword: { country: 'us' },
      },
      select: { keywordId: true, stats: true },
    });
    expect(medians).toEqual(new Map([['quiz', 21_500]]));
  });

  it('asks nothing without a reference day or a scored row', async () => {
    const findMany = jest.fn();
    const prisma = { keywordMetric: { findMany } } as unknown as PrismaService;

    await expect(
      medianRatingsAt(prisma, [row('quiz', ['2026-09-13'])], null, 'us'),
    ).resolves.toEqual(new Map());
    await expect(
      medianRatingsAt(prisma, [row('new', [])], REFERENCE, 'us'),
    ).resolves.toEqual(new Map());
    expect(findMany).not.toHaveBeenCalled();
  });
});
