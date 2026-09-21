import {
  competitorsScore,
  computeDifficulty,
  DIFFICULTY_WEIGHTS,
  freshnessScore,
} from './difficulty';
import { KeywordStats } from './formulas';
import * as fixtures from './scoring-fixtures';

describe('computeDifficulty', () => {
  it.each([
    ['F1 head', fixtures.F1_HEAD, 7.6847],
    ['F3 junk', fixtures.F3_JUNK, 4.3611],
    ['F4 empty', fixtures.F4_EMPTY, 0],
    ['F5 tail', fixtures.F5_TAIL, 1.4889],
    ['F6 outlier', fixtures.F6_OUTLIER, 3.4397],
    ['F12 not finite', fixtures.F12_NOT_FINITE, 7.457],
    ['F13 diacritics', fixtures.F13_DIACRITICS, 8.7365],
  ])('%s', (_name, stats, expected) => {
    expect(computeDifficulty(stats)).toBeCloseTo(expected, 3);
  });

  it('raises a brand query to the brand floor', () => {
    expect(computeDifficulty(fixtures.F2_BRAND)).toBe(8.5);
  });

  it('lets the small page cap beat the brand floor', () => {
    expect(computeDifficulty(fixtures.F7_SINGLE)).toBe(2);
  });

  it('loses exactly the freshness share when no update date is known', () => {
    const undated = {
      ...fixtures.F1_HEAD,
      top10: fixtures.F1_HEAD.top10.map((item) => ({
        ...item,
        daysSinceUpdate: undefined,
      })),
    };
    const freshness = 10 - 10 / 9;
    expect(
      computeDifficulty(fixtures.F1_HEAD) - computeDifficulty(undated),
    ).toBeCloseTo(DIFFICULTY_WEIGHTS.freshness * freshness, 3);
  });
});

describe('freshness and depth', () => {
  const page = (
    top30TitleMatchCount: number,
    daysSinceUpdate?: number,
  ): KeywordStats => ({
    ...fixtures.F1_HEAD,
    top30TitleMatchCount,
    top10: fixtures.F1_HEAD.top10.map((item) => ({
      ...item,
      daysSinceUpdate,
    })),
  });

  it.each([
    [page(30, 9), 10, 9],
    [page(0), 0, 0],
    [page(12, 45), 4, 5],
  ])('%#', (stats, depth, freshness) => {
    expect(competitorsScore(stats)).toBeCloseTo(depth, 2);
    expect(freshnessScore(stats)).toBeCloseTo(freshness, 2);
  });
});
