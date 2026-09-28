import type { Ranking, TrackedRow } from './analytics.support';
import { bucketPositions, rankDistributionAt } from './rank-distribution';

const REFERENCE = new Date('2026-07-13T00:00:00.000Z');
const EARLIER = new Date('2026-07-12T00:00:00.000Z');

const row = (rankings: Ranking[]): TrackedRow => ({
  keywordId: 'kw_1',
  source: 'TITLE',
  fieldOrder: null,
  relevance: null,
  keyword: { text: 'focus timer', metrics: [], rankings },
});

const rankedAt = (position: number | null, date = REFERENCE): TrackedRow =>
  row([{ position, depth: 200, date }]);

describe('bucketPositions', () => {
  it('assigns positions to disjoint bands', () => {
    const bands = bucketPositions([1, 2, 3, 4, 10, 11, 50, 51, 200, null]);
    expect(bands).toEqual({
      rank1: 1,
      rank2to3: 2,
      rank4to10: 2,
      rank11to50: 2,
      rank51plus: 2,
      unranked: 1,
    });
  });

  it('bands sum to the row count', () => {
    const positions = [1, 1, 3, 7, 40, 90, null, null];
    const bands = bucketPositions(positions);
    const total =
      bands.rank1 +
      bands.rank2to3 +
      bands.rank4to10 +
      bands.rank11to50 +
      bands.rank51plus +
      bands.unranked;
    expect(total).toBe(positions.length);
  });

  it('returns all zeros for no positions', () => {
    expect(bucketPositions([])).toEqual({
      rank1: 0,
      rank2to3: 0,
      rank4to10: 0,
      rank11to50: 0,
      rank51plus: 0,
      unranked: 0,
    });
  });
});

describe('rankDistributionAt', () => {
  it('counts positions into cumulative buckets', () => {
    const rows = [1, 3, 7, 40, 120, null].map((position) => rankedAt(position));

    expect(rankDistributionAt(rows, REFERENCE)).toEqual({
      top1: 1,
      top3: 2,
      top10: 3,
      top50: 4,
      beyond: 1,
      unranked: 1,
    });
  });

  it('counts a row not captured on the date as unranked', () => {
    expect(rankDistributionAt([rankedAt(4, EARLIER)], REFERENCE)).toEqual({
      top1: 0,
      top3: 0,
      top10: 0,
      top50: 0,
      beyond: 0,
      unranked: 1,
    });
  });

  it('counts every row as unranked without a date', () => {
    expect(rankDistributionAt([rankedAt(1), rankedAt(12)], null)).toEqual({
      top1: 0,
      top3: 0,
      top10: 0,
      top50: 0,
      beyond: 0,
      unranked: 2,
    });
  });
});
