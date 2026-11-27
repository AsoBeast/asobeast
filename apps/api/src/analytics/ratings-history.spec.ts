import {
  emptyStar,
  starCountsOf,
} from '../store-providers/star-counts.fixture';
import { collapseRatings, consistentStarCounts } from './ratings-history';

describe('consistentStarCounts', () => {
  it.each([
    [1000, 1000, true],
    [1000, 980, true],
    [1000, 979, false],
    [1000, 1020, true],
    [1000, 1021, false],
    [50000, 20000, false],
    [19570037, 19570011, true],
    [1000, 0, false],
  ])(
    'judges a star total for %i ratings of %i as kept %s',
    (ratingCount, total, kept) => {
      const counts = starCountsOf(total);

      expect(consistentStarCounts(counts, ratingCount)).toBe(
        kept ? counts : null,
      );
    },
  );

  it('answers null without counts', () => {
    expect(consistentStarCounts(null, 1000)).toBeNull();
  });

  it('answers null without a rating count', () => {
    expect(consistentStarCounts(starCountsOf(1000), null)).toBeNull();
  });

  it('answers null for a rating count of 0', () => {
    expect(consistentStarCounts(starCountsOf(1000), 0)).toBeNull();
  });
});

describe('collapseRatings', () => {
  it('keeps the latest snapshot of each UTC day, ordered ascending', () => {
    const points = collapseRatings([
      {
        ratingAvg: 4.5,
        ratingCount: 100,
        ratingHistogram: null,
        capturedAt: new Date('2026-07-10T02:00:00Z'),
      },
      {
        ratingAvg: 4.6,
        ratingCount: 110,
        ratingHistogram: null,
        capturedAt: new Date('2026-07-10T20:00:00Z'),
      },
      {
        ratingAvg: 4.4,
        ratingCount: 90,
        ratingHistogram: null,
        capturedAt: new Date('2026-07-09T12:00:00Z'),
      },
    ]);

    expect(points).toEqual([
      { date: '2026-07-09', ratingAvg: 4.4, ratingCount: 90 },
      { date: '2026-07-10', ratingAvg: 4.6, ratingCount: 110 },
    ]);
  });

  it('preserves null rating values', () => {
    const points = collapseRatings([
      {
        ratingAvg: null,
        ratingCount: null,
        ratingHistogram: null,
        capturedAt: new Date('2026-07-10T00:00:00Z'),
      },
    ]);

    expect(points).toEqual([
      { date: '2026-07-10', ratingAvg: null, ratingCount: null },
    ]);
  });

  it('returns an empty series when there are no snapshots', () => {
    expect(collapseRatings([])).toEqual([]);
  });

  it('carries the star counts of the newest snapshot of a day', () => {
    const points = collapseRatings([
      {
        ratingAvg: 4.5,
        ratingCount: 900,
        ratingHistogram: starCountsOf(900),
        capturedAt: new Date('2026-07-10T02:00:00Z'),
      },
      {
        ratingAvg: 4.6,
        ratingCount: 1000,
        ratingHistogram: starCountsOf(1000),
        capturedAt: new Date('2026-07-10T20:00:00Z'),
      },
    ]);

    expect(points).toEqual([
      {
        date: '2026-07-10',
        ratingAvg: 4.6,
        ratingCount: 1000,
        starCounts: starCountsOf(1000),
      },
    ]);
  });

  it('leaves the key out when the newest snapshot has none', () => {
    const points = collapseRatings([
      {
        ratingAvg: 4.5,
        ratingCount: 900,
        ratingHistogram: starCountsOf(900),
        capturedAt: new Date('2026-07-10T02:00:00Z'),
      },
      {
        ratingAvg: 4.6,
        ratingCount: 1000,
        ratingHistogram: null,
        capturedAt: new Date('2026-07-10T20:00:00Z'),
      },
    ]);

    expect(points[0]).not.toHaveProperty('starCounts');
  });

  it('leaves the key out when the star total is far from the rating count', () => {
    const points = collapseRatings([
      {
        ratingAvg: 4.6,
        ratingCount: 50000,
        ratingHistogram: emptyStar(starCountsOf(50000), '5'),
        capturedAt: new Date('2026-07-10T20:00:00Z'),
      },
    ]);

    expect(points[0]).not.toHaveProperty('starCounts');
  });

  it.each([[{ '1': 'many' }], ['nope'], [[]]])(
    'leaves the key out of a malformed column %j',
    (ratingHistogram) => {
      const points = collapseRatings([
        {
          ratingAvg: 4.6,
          ratingCount: 1000,
          ratingHistogram,
          capturedAt: new Date('2026-07-10T20:00:00Z'),
        },
      ]);

      expect(points[0]).not.toHaveProperty('starCounts');
    },
  );
});
