import {
  appStoreContext,
  competitor,
  daysAgo,
  playContext,
} from './audit-context.fixture';
import { buildBenchmarks } from './audit-benchmarks';

describe('buildBenchmarks', () => {
  it('is null without competitors', () => {
    expect(buildBenchmarks(appStoreContext({ competitors: [] }))).toBeNull();
  });

  it('takes the median of competitors that have a value and the best by direction', () => {
    const benchmarks = buildBenchmarks(
      appStoreContext({
        ratingCount: 341,
        storeUpdatedAt: daysAgo(10),
        competitors: [
          competitor({
            id: 'a',
            ratingCount: 100,
            storeUpdatedAt: daysAgo(40),
          }),
          competitor({ id: 'b', ratingCount: 900, storeUpdatedAt: daysAgo(5) }),
          competitor({ id: 'c', ratingCount: null, storeUpdatedAt: null }),
          competitor({
            id: 'd',
            ratingCount: 300,
            storeUpdatedAt: daysAgo(20),
          }),
        ],
      }),
    );

    expect(benchmarks?.competitors).toBe(4);
    expect(
      benchmarks?.rows.find((row) => row.metric === 'rating-count'),
    ).toEqual({
      metric: 'rating-count',
      label: 'Ratings',
      better: 'higher',
      you: 341,
      median: 300,
      best: 900,
      bestAppId: 'b',
    });
    expect(
      benchmarks?.rows.find((row) => row.metric === 'days-since-update'),
    ).toMatchObject({
      better: 'lower',
      median: 20,
      best: 5,
      bestAppId: 'b',
    });
  });

  it('takes the mean of the two middle values for an even count', () => {
    const benchmarks = buildBenchmarks(
      appStoreContext({
        ratingCount: 341,
        competitors: [100, 300, 500, 900].map((ratingCount, index) =>
          competitor({ id: `c${index}`, ratingCount }),
        ),
      }),
    );

    expect(
      benchmarks?.rows.find((row) => row.metric === 'rating-count')?.median,
    ).toBe(400);
  });

  it('keeps each store to its own metrics', () => {
    const apple = buildBenchmarks(
      appStoreContext({ competitors: [competitor({ id: 'a' })] }),
    )?.rows.map((row) => row.metric);
    const play = buildBenchmarks(
      playContext({
        competitors: [competitor({ id: 'a', screenshotCount: 24 })],
      }),
    )?.rows;

    expect(apple).not.toContain('has-video');
    expect(play?.map((row) => row.metric)).not.toContain('subtitle-length');
    expect(play?.find((row) => row.metric === 'screenshots')?.best).toBe(8);
  });

  it('reports nulls when no competitor carries a value', () => {
    expect(
      buildBenchmarks(
        appStoreContext({ competitors: [competitor({ id: 'a' })] }),
      )?.rows.find((row) => row.metric === 'rating-average'),
    ).toMatchObject({ median: null, best: null, bestAppId: null });
  });
});
