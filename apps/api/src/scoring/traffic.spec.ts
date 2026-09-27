import * as fixtures from './scoring-fixtures';
import { KeywordStats } from './formulas';
import { estimatePopularity, NEUTRAL_CONTINUATIONS } from './popularity-model';
import { computeTraffic, DEMAND_WEIGHT, estimateTraffic } from './traffic';

const play = (stats: KeywordStats): KeywordStats => ({
  ...stats,
  store: 'GOOGLE_PLAY',
});

const modelTraffic = (stats: KeywordStats): number =>
  (estimatePopularity(stats.competitors ?? stats.top10, stats.keywordText, {
    continuations: stats.continuations ?? NEUTRAL_CONTINUATIONS,
    reach: stats.suggest,
  }) ?? 0) / 10;

describe('computeTraffic on google play', () => {
  it.each([
    ['F1 head', fixtures.F1_HEAD, 4.7403],
    ['F2 brand', fixtures.F2_BRAND, 4.063],
    ['F3 junk', fixtures.F3_JUNK, 1.2],
    ['F4 empty', fixtures.F4_EMPTY, 0],
    ['F5 tail', fixtures.F5_TAIL, 1],
    ['F6 outlier', fixtures.F6_OUTLIER, 4.4],
    ['F7 single', fixtures.F7_SINGLE, 1],
    ['F8 unavailable', fixtures.F8_UNAVAILABLE, 3.2403],
    ['F12 not finite', fixtures.F12_NOT_FINITE, 4.6911],
    ['F13 diacritics', fixtures.F13_DIACRITICS, 3.616],
  ])('%s', (_name, stats, expected) => {
    expect(computeTraffic(play(stats))).toBeCloseTo(expected, 3);
  });

  it('rises when the store offers the keyword sooner', () => {
    const sooner = {
      ...play(fixtures.F1_HEAD),
      suggest: { status: 'hit', prefixLength: 1, position: 1 } as const,
    };
    expect(computeTraffic(sooner)).toBeGreaterThan(
      computeTraffic(play(fixtures.F1_HEAD)),
    );
  });

  it('caps a keyword the store never suggests', () => {
    expect(computeTraffic(fixtures.F3_JUNK)).toBeLessThanOrEqual(1.5);
  });

  it('caps a thin page and releases the cap at five results', () => {
    expect(computeTraffic(play({ ...fixtures.F1_HEAD, resultCount: 4 }))).toBe(
      1,
    );
    expect(
      computeTraffic(play({ ...fixtures.F1_HEAD, resultCount: 5 })),
    ).toBeCloseTo(4.7403, 3);
  });

  it('reads no demand from a page without a single finite rating count', () => {
    const blind = {
      ...play(fixtures.F1_HEAD),
      top10: fixtures.F1_HEAD.top10.map((item) => ({
        ...item,
        ratingCount: undefined,
      })),
    };
    expect(computeTraffic(blind)).toBeCloseTo(4, 3);
  });

  it('adds a small share of demand to the reach', () => {
    const rich = computeTraffic(play(fixtures.F1_HEAD));
    const poor = computeTraffic(play(fixtures.F6_OUTLIER));
    expect(DEMAND_WEIGHT).toBe(0.12);
    expect(rich - 4).toBeCloseTo(DEMAND_WEIGHT * 6.1688, 3);
    expect(poor).toBe(4.4);
  });

  it('does not discount a longer phrase the store offers as early', () => {
    const short = computeTraffic(
      play({ ...fixtures.F6_OUTLIER, keywordText: 'quiz' }),
    );
    const long = computeTraffic(
      play({ ...fixtures.F6_OUTLIER, keywordText: 'quiz games for adults' }),
    );
    expect(long).toBe(short);
  });

  it('scores a failed suggest lookup at a typical reach, not on demand alone', () => {
    expect(computeTraffic(play(fixtures.F8_UNAVAILABLE))).toBeCloseTo(
      2.5 + DEMAND_WEIGHT * 6.1688,
      3,
    );
  });
});

describe('computeTraffic on the app store', () => {
  it("reads the popularity model on Apple's scale", () => {
    expect(estimateTraffic(fixtures.F1_HEAD)).toBe(
      modelTraffic(fixtures.F1_HEAD),
    );
    expect(computeTraffic(fixtures.F1_HEAD)).toBe(
      estimateTraffic(fixtures.F1_HEAD),
    );
  });

  it('prefers the first 25 results over the top ten', () => {
    const stats = {
      ...fixtures.F5_TAIL,
      competitors: fixtures.headTopTen(),
    };
    expect(estimateTraffic(stats)).toBe(
      (estimatePopularity(fixtures.headTopTen(), stats.keywordText, {
        continuations: NEUTRAL_CONTINUATIONS,
        reach: stats.suggest,
      }) ?? 0) / 10,
    );
  });

  it('caps a thin page and releases the cap at five results', () => {
    const tiny = { ...fixtures.F1_HEAD, resultCount: 4 };
    expect(computeTraffic(tiny)).toBe(1);
    expect(computeTraffic({ ...tiny, resultCount: 5 })).toBe(
      modelTraffic(fixtures.F1_HEAD),
    );
  });

  it('keeps a nonsense search with one unrelated result low', () => {
    const nonsense = {
      ...fixtures.F4_EMPTY,
      keywordText: 'xqzvw',
      resultCount: 1,
      top10: [{ title: 'Calculator' }],
    };
    expect(computeTraffic(nonsense)).toBeLessThanOrEqual(1);
  });

  it('reads suggest reach', () => {
    const absent = {
      ...fixtures.F1_HEAD,
      suggest: { status: 'absent' } as const,
    };
    expect(computeTraffic(absent)).toBeLessThan(
      computeTraffic(fixtures.F1_HEAD),
    );
  });

  it('prefers the official value and keeps the estimate apart', () => {
    expect(computeTraffic(fixtures.F9_OFFICIAL)).toBeCloseTo(7.1, 3);
    expect(estimateTraffic(fixtures.F9_OFFICIAL)).toBe(
      modelTraffic(fixtures.F1_HEAD),
    );
  });

  it('caps an unlisted term just below its genre floor', () => {
    const estimate = modelTraffic(fixtures.F1_HEAD);
    expect(computeTraffic(fixtures.F10_ABSENT_CAP)).toBeCloseTo(
      Math.min(estimate, 4),
      6,
    );
    expect(
      computeTraffic({ ...fixtures.F1_HEAD, official: { absentBelow: 101 } }),
    ).toBe(estimate);
  });

  it.each([0, 1, 5])(
    'never caps an unlisted term below 1.5 for a floor of %s',
    (absentBelow) => {
      expect(
        computeTraffic({ ...fixtures.F1_HEAD, official: { absentBelow } }),
      ).toBeCloseTo(Math.min(modelTraffic(fixtures.F1_HEAD), 1.5), 6);
    },
  );

  it('keeps the official value when the search returned nothing', () => {
    const empty = { ...fixtures.F9_OFFICIAL, resultCount: 0, top10: [] };
    expect(computeTraffic(empty)).toBeCloseTo(7.1, 3);
    expect(estimateTraffic(empty)).toBe(0);
  });
});
