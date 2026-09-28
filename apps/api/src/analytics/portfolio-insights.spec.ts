import { PortfolioAppInsight } from '@asobeast/shared';
import type { Ranking, TrackedRow } from './analytics.support';
import { RankedMover } from './movers';
import {
  insightTotals,
  mergePortfolioMovers,
  rankInsight,
  ratingTrend,
} from './portfolio-insights';

const REFERENCE = new Date('2026-07-13T00:00:00.000Z');
const WEEK_AGO = new Date('2026-07-06T00:00:00.000Z');
const TWO_DAYS_AGO = new Date('2026-07-11T00:00:00.000Z');

const row = (keywordId: string, rankings: Ranking[]): TrackedRow => ({
  keywordId,
  source: 'TITLE',
  fieldOrder: null,
  relevance: null,
  keyword: { text: keywordId, country: 'us', metrics: [], rankings },
});

const capture = (position: number | null, date: Date): Ranking => ({
  position,
  depth: 200,
  date,
});

const mover = (text: string, change: number): RankedMover => ({
  keywordId: `kw_${text}`,
  text,
  country: 'us',
  from: 20,
  fromDepth: 200,
  to: 20 - change,
  toDepth: 200,
  change,
});

const insight = (
  overrides: Partial<PortfolioAppInsight>,
): PortfolioAppInsight => ({
  appId: 'app_1',
  rankDistribution: {
    top1: 0,
    top3: 0,
    top10: 0,
    top50: 0,
    beyond: 0,
    unranked: 0,
  },
  top10Delta7d: null,
  movement: { up: 0, down: 0, entered: 0, lost: 0 },
  rating: { average: null, count: null, averageDelta7d: null },
  audit: null,
  actions: null,
  changes7d: { own: 0, competitors: 0 },
  negativeReviews7d: 0,
  ...overrides,
});

describe('rankInsight', () => {
  it('reports zeros and no trend without a reference date', () => {
    const result = rankInsight([row('focus', [capture(3, REFERENCE)])], null);

    expect(result.rankDistribution).toEqual({
      top1: 0,
      top3: 0,
      top10: 0,
      top50: 0,
      beyond: 0,
      unranked: 1,
    });
    expect(result.top10Delta7d).toBeNull();
    expect(result.movement).toEqual({ up: 0, down: 0, entered: 0, lost: 0 });
  });

  it('compares the top 10 with the capture seven days earlier', () => {
    const rows = [
      row('focus', [capture(3, REFERENCE), capture(14, WEEK_AGO)]),
      row('timer', [capture(8, REFERENCE), capture(9, WEEK_AGO)]),
      row('pomodoro', [capture(40, REFERENCE), capture(40, WEEK_AGO)]),
    ];

    expect(rankInsight(rows, REFERENCE).top10Delta7d).toBe(1);
  });

  it('reports no top 10 trend without a capture seven days earlier', () => {
    const rows = [
      row('focus', [capture(3, REFERENCE), capture(14, TWO_DAYS_AGO)]),
    ];

    expect(rankInsight(rows, REFERENCE).top10Delta7d).toBeNull();
  });

  it('counts entered and lost keywords inside the climbers and fallers', () => {
    const rows = [
      row('entered', [capture(9, REFERENCE), capture(null, WEEK_AGO)]),
      row('climbed', [capture(4, REFERENCE), capture(12, WEEK_AGO)]),
      row('lost', [capture(null, REFERENCE), capture(30, WEEK_AGO)]),
    ];

    expect(rankInsight(rows, REFERENCE).movement).toEqual({
      up: 2,
      down: 1,
      entered: 1,
      lost: 1,
    });
  });
});

describe('mergePortfolioMovers', () => {
  it('orders climbers across apps by change and keeps five', () => {
    const merged = mergePortfolioMovers([
      {
        appId: 'app_1',
        movers: {
          up: [mover('alpha', 9), mover('bravo', 3), mover('delta', 1)],
          down: [],
        },
      },
      {
        appId: 'app_2',
        movers: {
          up: [mover('charlie', 7), mover('echo', 3), mover('foxtrot', 2)],
          down: [],
        },
      },
    ]);

    expect(merged.up.map((entry) => entry.text)).toEqual([
      'alpha',
      'charlie',
      'bravo',
      'echo',
      'foxtrot',
    ]);
  });

  it('orders fallers by the largest drop first', () => {
    const merged = mergePortfolioMovers([
      { appId: 'app_1', movers: { up: [], down: [mover('slow', -2)] } },
      { appId: 'app_2', movers: { up: [], down: [mover('steep', -11)] } },
    ]);

    expect(merged.down.map((entry) => entry.text)).toEqual(['steep', 'slow']);
  });

  it('tags each mover with its app and country and drops the change', () => {
    const merged = mergePortfolioMovers([
      {
        appId: 'app_2',
        movers: { up: [{ ...mover('focus', 6), country: 'de' }], down: [] },
      },
    ]);

    expect(merged.up).toEqual([
      {
        appId: 'app_2',
        country: 'de',
        keywordId: 'kw_focus',
        text: 'focus',
        from: 20,
        fromDepth: 200,
        to: 14,
        toDepth: 200,
      },
    ]);
  });
});

describe('insightTotals', () => {
  it('sums the top 10, movement, changes and negative reviews', () => {
    const totals = insightTotals([
      insight({
        rankDistribution: {
          top1: 1,
          top3: 2,
          top10: 4,
          top50: 5,
          beyond: 0,
          unranked: 0,
        },
        top10Delta7d: 2,
        movement: { up: 3, down: 1, entered: 1, lost: 0 },
        changes7d: { own: 1, competitors: 2 },
        negativeReviews7d: 2,
      }),
      insight({
        appId: 'app_2',
        rankDistribution: {
          top1: 0,
          top3: 1,
          top10: 3,
          top50: 3,
          beyond: 1,
          unranked: 2,
        },
        top10Delta7d: -1,
        movement: { up: 1, down: 2, entered: 0, lost: 1 },
        changes7d: { own: 0, competitors: 1 },
        negativeReviews7d: 1,
      }),
    ]);

    expect(totals).toEqual({
      top10: 7,
      top10Delta7d: 1,
      movement: { up: 4, down: 3, entered: 1, lost: 1 },
      changes7d: { own: 1, competitors: 3 },
      negativeReviews7d: 3,
    });
  });

  it('sums only the known top 10 deltas and is null when none is known', () => {
    expect(
      insightTotals([
        insight({ top10Delta7d: 2 }),
        insight({ top10Delta7d: null }),
      ]).top10Delta7d,
    ).toBe(2);
    expect(insightTotals([insight({}), insight({})]).top10Delta7d).toBeNull();
    expect(insightTotals([]).top10Delta7d).toBeNull();
  });
});

describe('ratingTrend', () => {
  it('rounds the average delta to two decimals', () => {
    expect(
      ratingTrend(
        { ratingAvg: 4.6, ratingCount: 1840 },
        { ratingAvg: 4.5, ratingCount: 1700 },
      ),
    ).toEqual({ average: 4.6, count: 1840, averageDelta7d: 0.1 });
  });

  it('reports no delta when either side is missing', () => {
    expect(ratingTrend({ ratingAvg: 4.6, ratingCount: 10 }, null)).toEqual({
      average: 4.6,
      count: 10,
      averageDelta7d: null,
    });
    expect(
      ratingTrend(
        { ratingAvg: null, ratingCount: null },
        { ratingAvg: 4.1, ratingCount: 3 },
      ),
    ).toEqual({ average: null, count: null, averageDelta7d: null });
    expect(ratingTrend(null, null)).toEqual({
      average: null,
      count: null,
      averageDelta7d: null,
    });
  });
});
