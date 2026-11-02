import { buildScoreSignals, readScoreSignals } from './score-signals';
import {
  F10_ABSENT_CAP,
  F14_FLOOR_LISTED,
  F15_ABSENT_WITH_HISTORY,
  F16_LISTED_ABOVE_FLOOR,
  F2_BRAND,
  F4_EMPTY,
  F5_TAIL,
  F9_OFFICIAL,
} from './scoring-fixtures';
import { computeTraffic, estimateTraffic } from './traffic';

describe('buildScoreSignals', () => {
  it('describes a brand page', () => {
    const signals = buildScoreSignals(F2_BRAND, computeTraffic(F2_BRAND));
    expect(signals).toEqual({
      suggestReach: 'hit',
      suggestPrefixLength: 4,
      suggestPosition: 4,
      serpRelevance: expect.closeTo(0.1, 6) as number,
      medianRatingCount: 800,
      flags: ['brand', 'padded'],
      officialPopularity: null,
      estimatedTraffic: expect.closeTo(3.7, 3) as number,
      entryDifficulty: 1.3,
    });
  });

  it('keeps only the position of a listed keyword', () => {
    expect(buildScoreSignals(F5_TAIL, 0.78)).toMatchObject({
      suggestReach: 'listed',
      suggestPrefixLength: null,
      suggestPosition: 1,
    });
  });

  it('has no median without a single rating count', () => {
    expect(buildScoreSignals(F4_EMPTY, 0)).toMatchObject({
      suggestReach: 'absent',
      suggestPrefixLength: null,
      suggestPosition: null,
      medianRatingCount: null,
      flags: ['small_serp', 'padded'],
    });
  });
});

describe('official popularity in the signals', () => {
  it.each([
    ['an official value', F9_OFFICIAL, 71, 5.4],
    ['an absent cap', F10_ABSENT_CAP, null, 5.2],
  ])('records %s next to the estimate', (_name, stats, official, estimate) => {
    expect(buildScoreSignals(stats, estimateTraffic(stats))).toMatchObject({
      officialPopularity: official,
      estimatedTraffic: expect.closeTo(estimate, 3) as number,
    });
  });

  it.each([
    [
      'a term listed at the floor',
      F14_FLOOR_LISTED,
      {
        officialPopularity: 41,
        officialPopularityState: 'floor',
        officialPopularityFloor: 41,
        officialPopularityWeek: '2026-10-18',
        officialPopularityLastAboveFloor: { value: 63, week: '2026-09-06' },
      },
    ],
    [
      'a term left out with history',
      F15_ABSENT_WITH_HISTORY,
      {
        officialPopularity: null,
        officialPopularityState: 'absent',
        officialPopularityFloor: 41,
        officialPopularityWeek: '2026-10-18',
        officialPopularityLastAboveFloor: { value: 58, week: '2026-09-27' },
      },
    ],
    [
      'a term listed above the floor',
      F16_LISTED_ABOVE_FLOOR,
      {
        officialPopularity: 71,
        officialPopularityState: 'listed',
        officialPopularityFloor: 56,
        officialPopularityWeek: '2026-10-18',
      },
    ],
  ])('records the floor answer of %s', (_name, stats, expected) => {
    expect(buildScoreSignals(stats, estimateTraffic(stats))).toMatchObject(
      expected,
    );
  });
});

describe('readScoreSignals', () => {
  const signals = buildScoreSignals(F2_BRAND, computeTraffic(F2_BRAND));

  it('reads the stored signals back', () => {
    expect(readScoreSignals({ ...F2_BRAND, signals })).toEqual(signals);
  });

  it('reads a floor answer back', () => {
    const floor = buildScoreSignals(
      F14_FLOOR_LISTED,
      estimateTraffic(F14_FLOOR_LISTED),
    );

    expect(readScoreSignals({ ...F14_FLOOR_LISTED, signals: floor })).toEqual(
      floor,
    );
    expect(floor.officialPopularityLastAboveFloor).toEqual({
      value: 63,
      week: '2026-09-06',
    });
  });

  it.each([
    'officialPopularityState',
    'officialPopularityFloor',
    'officialPopularityWeek',
    'officialPopularityLastAboveFloor',
  ])('reads no %s from a row stored before it existed', (key) => {
    expect(readScoreSignals({ signals })).not.toHaveProperty(key);
  });

  it('drops a malformed floor answer field without dropping the row', () => {
    expect(
      readScoreSignals({
        signals: {
          ...signals,
          officialPopularityFloor: '41',
          officialPopularityState: 'below',
          officialPopularityLastAboveFloor: { value: '63' },
        },
      }),
    ).toEqual(signals);
  });

  it.each([
    ['a v1 stats object', { store: 'APP_STORE', suggest: { priority: 9 } }],
    ['null', null],
    ['a wrongly typed field', { signals: { flags: 'brand' } }],
    ['an unknown flag', { signals: { ...signals, flags: ['famous'] } }],
    ['an unknown status', { signals: { ...signals, suggestReach: 'maybe' } }],
    [
      'a text traffic estimate',
      { signals: { ...signals, estimatedTraffic: '4' } },
    ],
  ])('returns null for %s', (_name, stats) => {
    expect(readScoreSignals(stats)).toBeNull();
  });
});
