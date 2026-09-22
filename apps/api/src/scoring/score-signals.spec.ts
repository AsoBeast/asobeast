import { buildScoreSignals, readScoreSignals } from './score-signals';
import {
  F10_ABSENT_CAP,
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
      estimatedTraffic: expect.closeTo(5.4, 3) as number,
      entryDifficulty: 2.3,
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
    ['an official value', F9_OFFICIAL, 71],
    ['an absent cap', F10_ABSENT_CAP, null],
  ])('records %s next to the estimate', (_name, stats, official) => {
    expect(buildScoreSignals(stats, estimateTraffic(stats))).toMatchObject({
      officialPopularity: official,
      estimatedTraffic: expect.closeTo(6.5, 3) as number,
    });
  });
});

describe('readScoreSignals', () => {
  const signals = buildScoreSignals(F2_BRAND, computeTraffic(F2_BRAND));

  it('reads the stored signals back', () => {
    expect(readScoreSignals({ ...F2_BRAND, signals })).toEqual(signals);
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
