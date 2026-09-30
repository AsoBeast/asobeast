import * as fixtures from './scoring-fixtures';
import { KeywordStats } from './formulas';
import {
  estimatePopularity,
  NEUTRAL_CONTINUATIONS,
  PopularityWeights,
  UNLISTED_POPULARITY_WEIGHTS,
} from './popularity-model';
import { pageStrength, targetingShare } from './difficulty';
import {
  computeTraffic,
  estimateTraffic,
  SUGGEST_WEIGHTS,
  TYPICAL_REACH,
  TYPICAL_UNTYPED,
} from './traffic';

const play = (stats: KeywordStats): KeywordStats => ({
  ...stats,
  store: 'GOOGLE_PLAY',
});

const modelTraffic = (
  stats: KeywordStats,
  weights?: PopularityWeights,
): number =>
  (estimatePopularity(
    stats.competitors ?? stats.top10,
    stats.keywordText,
    {
      continuations: stats.continuations ?? NEUTRAL_CONTINUATIONS,
      reach: stats.suggest,
    },
    weights,
  ) ?? 0) / 10;

const unlistedTraffic = (stats: KeywordStats): number =>
  modelTraffic(stats, UNLISTED_POPULARITY_WEIGHTS);

describe('computeTraffic on google play', () => {
  const blend = (reach: number, untyped: number, stats: KeywordStats): number =>
    SUGGEST_WEIGHTS.reach * reach +
    SUGGEST_WEIGHTS.untyped * untyped +
    SUGGEST_WEIGHTS.strength * pageStrength(stats.top10) +
    SUGGEST_WEIGHTS.targeting * targetingShare(stats.top10, stats.keywordText);

  it('publishes the fitted weights', () => {
    expect(SUGGEST_WEIGHTS).toEqual({
      reach: 0.5,
      untyped: 1.5,
      strength: 1.1,
      targeting: 1.9,
    });
  });

  it.each([
    ['F1 head', fixtures.F1_HEAD, 4.4995],
    ['F2 brand', fixtures.F2_BRAND, 3.0784],
    ['F3 junk', fixtures.F3_JUNK, 1.5],
    ['F4 empty', fixtures.F4_EMPTY, 0],
    ['F5 tail', fixtures.F5_TAIL, 1.2629],
    ['F6 outlier', fixtures.F6_OUTLIER, 5.1475],
    ['F7 single', fixtures.F7_SINGLE, 1],
    ['F8 unavailable', fixtures.F8_UNAVAILABLE, 4.3495],
    ['F12 not finite', fixtures.F12_NOT_FINITE, 4.449],
    ['F13 diacritics', fixtures.F13_DIACRITICS, 4.75],
  ])('%s', (_name, stats, expected) => {
    expect(computeTraffic(play(stats))).toBeCloseTo(expected, 3);
  });

  it('adds reach, the untyped share, page strength and targeting', () => {
    const stats = play({
      ...fixtures.F1_HEAD,
      keywordText: 'quiz games',
      suggest: { status: 'hit', prefixLength: 4, position: 1 },
    });
    expect(computeTraffic(stats)).toBeCloseTo(blend(4, 0.6, stats), 6);
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
    ).toBeCloseTo(4.4995, 3);
  });

  it('reads no strength from a page without a single finite rating count', () => {
    const blind = {
      ...play(fixtures.F1_HEAD),
      top10: fixtures.F1_HEAD.top10.map((item) => ({
        ...item,
        ratingCount: undefined,
      })),
    };
    expect(pageStrength(blind.top10)).toBe(0);
    expect(computeTraffic(blind)).toBeCloseTo(blend(4, 0, blind), 6);
  });

  it('rises with the strength of the page', () => {
    const strong = play(fixtures.F1_HEAD);
    const weak = { ...strong, top10: fixtures.tailTopTen() };
    expect(targetingShare(weak.top10, weak.keywordText)).toBe(0);
    expect(
      computeTraffic({ ...strong, keywordText: 'trivia' }) -
        computeTraffic({ ...weak, keywordText: 'trivia' }),
    ).toBeCloseTo(
      SUGGEST_WEIGHTS.strength *
        (pageStrength(strong.top10) - pageStrength(weak.top10)),
      6,
    );
  });

  it('rises when more of the titles target the phrase', () => {
    const targeted = play(fixtures.F1_HEAD);
    const untargeted = { ...targeted, keywordText: 'quip' };
    expect(computeTraffic(targeted) - computeTraffic(untargeted)).toBeCloseTo(
      SUGGEST_WEIGHTS.targeting,
      6,
    );
  });

  it('credits a longer phrase the store offers as early', () => {
    const offered = { status: 'hit', prefixLength: 4, position: 1 } as const;
    const short = play({
      ...fixtures.F6_OUTLIER,
      keywordText: 'trivia',
      suggest: offered,
    });
    const long = { ...short, keywordText: 'trivia games for adults' };
    expect(computeTraffic(long) - computeTraffic(short)).toBeCloseTo(
      SUGGEST_WEIGHTS.untyped * (19 / 23 - 2 / 6),
      6,
    );
  });

  it('scores a failed suggest lookup at a typical reach and untyped share', () => {
    const failed = play(fixtures.F8_UNAVAILABLE);
    expect(computeTraffic(failed)).toBeCloseTo(
      blend(TYPICAL_REACH, TYPICAL_UNTYPED, failed),
      6,
    );
    expect(TYPICAL_REACH).toBe(2.5);
    expect(TYPICAL_UNTYPED).toBe(0.4);
  });

  it('never leaves the stored scale', () => {
    const giant = play({
      ...fixtures.F1_HEAD,
      keywordText: 'quiz games for adults offline',
      suggest: { status: 'hit', prefixLength: 1, position: 1 },
      top10: fixtures.junkTopTen().map((item) => ({
        ...item,
        title: 'Quiz games for adults offline',
      })),
    });
    expect(computeTraffic(giant)).toBeLessThanOrEqual(10);
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

  it('reads an unlisted term on the weights fitted for unlisted terms', () => {
    const unlisted = {
      ...fixtures.F5_TAIL,
      official: { absentBelow: 101 },
    };
    expect(computeTraffic(unlisted)).toBe(unlistedTraffic(fixtures.F5_TAIL));
    expect(unlistedTraffic(fixtures.F5_TAIL)).not.toBe(
      modelTraffic(fixtures.F5_TAIL),
    );
  });

  it('keeps the estimate of an unlisted term on the weights that scored it', () => {
    expect(estimateTraffic(fixtures.F10_ABSENT_CAP)).toBe(
      unlistedTraffic(fixtures.F1_HEAD),
    );
    expect(computeTraffic(fixtures.F10_ABSENT_CAP)).toBeLessThanOrEqual(
      estimateTraffic(fixtures.F10_ABSENT_CAP),
    );
  });

  it('caps an unlisted term just below its genre floor', () => {
    const estimate = unlistedTraffic(fixtures.F1_HEAD);
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
      ).toBeCloseTo(Math.min(unlistedTraffic(fixtures.F1_HEAD), 1.5), 6);
    },
  );

  it('caps a thin unlisted page like any other', () => {
    expect(
      computeTraffic({
        ...fixtures.F1_HEAD,
        resultCount: 4,
        official: { absentBelow: 41 },
      }),
    ).toBe(1);
  });

  it('keeps the official value when the search returned nothing', () => {
    const empty = { ...fixtures.F9_OFFICIAL, resultCount: 0, top10: [] };
    expect(computeTraffic(empty)).toBeCloseTo(7.1, 3);
    expect(estimateTraffic(empty)).toBe(0);
  });
});
