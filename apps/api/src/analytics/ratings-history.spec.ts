import { collapseRatings } from './ratings-history';

describe('collapseRatings', () => {
  it('keeps the latest snapshot of each UTC day, ordered ascending', () => {
    const points = collapseRatings([
      {
        ratingAvg: 4.5,
        ratingCount: 100,
        capturedAt: new Date('2026-07-10T02:00:00Z'),
      },
      {
        ratingAvg: 4.6,
        ratingCount: 110,
        capturedAt: new Date('2026-07-10T20:00:00Z'),
      },
      {
        ratingAvg: 4.4,
        ratingCount: 90,
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
});
