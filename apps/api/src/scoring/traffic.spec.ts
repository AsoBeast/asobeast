import * as fixtures from './scoring-fixtures';
import { computeTraffic, estimateTraffic, WORD_FACTORS } from './traffic';

describe('computeTraffic', () => {
  it.each([
    ['F1 head', fixtures.F1_HEAD, 6.2315],
    ['F2 brand', fixtures.F2_BRAND, 4.1673],
    ['F3 junk', fixtures.F3_JUNK, 0.805],
    ['F4 empty', fixtures.F4_EMPTY, 0],
    ['F5 tail', fixtures.F5_TAIL, 0.78],
    ['F6 outlier', fixtures.F6_OUTLIER, 4.5245],
    ['F7 single', fixtures.F7_SINGLE, 1],
    ['F8 unavailable', fixtures.F8_UNAVAILABLE, 5.1699],
    ['F12 not finite', fixtures.F12_NOT_FINITE, 6.0774],
    ['F13 diacritics', fixtures.F13_DIACRITICS, 5.7316],
  ])('%s', (_name, stats, expected) => {
    expect(computeTraffic(stats)).toBeCloseTo(expected, 3);
  });

  it('rises when the store offers the keyword sooner', () => {
    const sooner = {
      ...fixtures.F1_HEAD,
      suggest: { status: 'hit', prefixLength: 1, position: 1 } as const,
    };
    expect(computeTraffic(sooner)).toBeGreaterThan(
      computeTraffic(fixtures.F1_HEAD),
    );
  });

  it('caps a keyword the store never suggests on either store', () => {
    expect(
      computeTraffic({ ...fixtures.F3_JUNK, store: 'APP_STORE' }),
    ).toBeLessThanOrEqual(1.5);
  });

  it('caps a thin page and releases the cap at five results', () => {
    expect(computeTraffic({ ...fixtures.F1_HEAD, resultCount: 4 })).toBe(1);
    expect(computeTraffic({ ...fixtures.F1_HEAD, resultCount: 5 })).toBeCloseTo(
      6.2315,
      3,
    );
  });

  it('reads no demand from a page without a single finite rating count', () => {
    const blind = {
      ...fixtures.F1_HEAD,
      top10: fixtures.F1_HEAD.top10.map((item) => ({
        ...item,
        ratingCount: undefined,
      })),
    };
    expect(computeTraffic(blind)).toBeCloseTo(0.65 * 5.61, 3);
  });

  it('discounts by word count and stays on the scale', () => {
    const words = ['a', 'a b', 'a b c', 'a b c d', 'a b c d e', 'a b c d e f'];
    const scores = words.map((keywordText) =>
      computeTraffic({ ...fixtures.F1_HEAD, keywordText }),
    );
    expect(WORD_FACTORS).toEqual([1, 1, 0.92, 0.8, 0.65, 0.5]);
    expect(scores[4]).toBe(scores[5]);
    scores.forEach((score) => {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(10);
    });
  });

  it('prefers the official value and keeps the estimate apart', () => {
    expect(computeTraffic(fixtures.F9_OFFICIAL)).toBeCloseTo(7.1, 3);
    expect(computeTraffic(fixtures.F10_ABSENT_CAP)).toBeCloseTo(4, 3);
    expect(estimateTraffic(fixtures.F9_OFFICIAL)).toBeCloseTo(6.2315, 3);
    expect(estimateTraffic(fixtures.F10_ABSENT_CAP)).toBeCloseTo(6.2315, 3);
  });

  it('leaves an estimate below the absent cap alone', () => {
    expect(
      computeTraffic({ ...fixtures.F1_HEAD, official: { absentBelow: 90 } }),
    ).toBeCloseTo(6.2315, 3);
  });

  it.each([0, 1, 5])(
    'never caps an unlisted term below the absent cap for a floor of %s',
    (absentBelow) => {
      expect(
        computeTraffic({ ...fixtures.F1_HEAD, official: { absentBelow } }),
      ).toBeCloseTo(1.5, 6);
    },
  );

  it('keeps the official value when the search returned nothing', () => {
    const empty = { ...fixtures.F9_OFFICIAL, resultCount: 0, top10: [] };
    expect(computeTraffic(empty)).toBeCloseTo(7.1, 3);
    expect(estimateTraffic(empty)).toBe(0);
  });

  it('equals the estimate when no official value exists', () => {
    expect(estimateTraffic(fixtures.F1_HEAD)).toBe(
      computeTraffic(fixtures.F1_HEAD),
    );
  });
});
