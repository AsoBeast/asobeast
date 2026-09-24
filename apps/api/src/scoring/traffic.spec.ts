import * as fixtures from './scoring-fixtures';
import { KeywordStats } from './formulas';
import { estimatePopularity } from './popularity-model';
import { computeTraffic, estimateTraffic, WORD_FACTORS } from './traffic';

const play = (stats: KeywordStats): KeywordStats => ({
  ...stats,
  store: 'GOOGLE_PLAY',
});

const modelTraffic = (stats: KeywordStats): number =>
  (estimatePopularity(stats.serp, stats.keywordText) ?? 0) / 10;

describe('computeTraffic on google play', () => {
  it.each([
    ['F1 head', fixtures.F1_HEAD, 5.8056],
    ['F2 brand', fixtures.F2_BRAND, 4.0876],
    ['F3 junk', fixtures.F3_JUNK, 0.805],
    ['F4 empty', fixtures.F4_EMPTY, 0],
    ['F5 tail', fixtures.F5_TAIL, 0.78],
    ['F6 outlier', fixtures.F6_OUTLIER, 4.5245],
    ['F7 single', fixtures.F7_SINGLE, 1],
    ['F8 unavailable', fixtures.F8_UNAVAILABLE, 4.3181],
    ['F12 not finite', fixtures.F12_NOT_FINITE, 5.6623],
    ['F13 diacritics', fixtures.F13_DIACRITICS, 5.5062],
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
    ).toBeCloseTo(5.8056, 3);
  });

  it('reads no demand from a page without a single finite rating count', () => {
    const blind = {
      ...play(fixtures.F1_HEAD),
      serp: fixtures.F1_HEAD.serp.map((item) => ({
        ...item,
        ratingCount: undefined,
      })),
    };
    expect(computeTraffic(blind)).toBeCloseTo(0.65 * 5.61, 3);
  });

  it('discounts by word count and stays on the scale', () => {
    const words = ['a', 'a b', 'a b c', 'a b c d', 'a b c d e', 'a b c d e f'];
    const scores = words.map((keywordText) =>
      computeTraffic(play({ ...fixtures.F1_HEAD, keywordText })),
    );
    expect(WORD_FACTORS).toEqual([1, 1, 0.92, 0.8, 0.65, 0.5]);
    expect(scores[4]).toBe(scores[5]);
    scores.forEach((score) => {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(10);
    });
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

  it('reads the results past the top ten', () => {
    const stats = {
      ...fixtures.F5_TAIL,
      serp: [
        ...fixtures.F5_TAIL.serp,
        ...Array.from({ length: 15 }, () => ({
          title: 'Guess the Location',
          ratingCount: 500_000,
        })),
      ],
    };
    expect(estimateTraffic(stats)).toBe(modelTraffic(stats));
    expect(estimateTraffic(stats)).not.toBe(modelTraffic(fixtures.F5_TAIL));
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
      serp: [{ title: 'Calculator' }],
    };
    expect(computeTraffic(nonsense)).toBeLessThanOrEqual(1);
  });

  it('ignores suggest reach', () => {
    const absent = {
      ...fixtures.F1_HEAD,
      suggest: { status: 'absent' } as const,
    };
    expect(computeTraffic(absent)).toBe(computeTraffic(fixtures.F1_HEAD));
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
    const empty = { ...fixtures.F9_OFFICIAL, resultCount: 0, serp: [] };
    expect(computeTraffic(empty)).toBeCloseTo(7.1, 3);
    expect(estimateTraffic(empty)).toBe(0);
  });
});
