import {
  scoringConfidence,
  ScoringEvidence,
  scoringProfile,
} from './provenance';

const evidence = (
  completeSearch: boolean,
  secondaryComplete: boolean,
  completeDetails = false,
): ScoringEvidence => ({
  searchResultCount: completeSearch ? 10 : 9,
  suggestCompleted: secondaryComplete,
  prefixSweepCompleted: secondaryComplete,
  detailTargetCount: 10,
  detailSuccessCount: completeDetails ? 8 : 7,
});

describe('scoring provenance', () => {
  it.each([
    [false, false, 'LOW'],
    [true, false, 'MEDIUM'],
    [false, true, 'MEDIUM'],
    [true, true, 'HIGH'],
  ] as const)(
    'maps Apple evidence %s/%s to %s confidence',
    (search, suggest, expected) => {
      expect(scoringConfidence('APP_STORE', evidence(search, suggest))).toBe(
        expected,
      );
    },
  );

  it.each([
    [false, false, false, 'LOW'],
    [true, false, false, 'LOW'],
    [false, true, false, 'LOW'],
    [false, false, true, 'LOW'],
    [true, true, false, 'MEDIUM'],
    [true, false, true, 'MEDIUM'],
    [false, true, true, 'MEDIUM'],
    [true, true, true, 'HIGH'],
  ] as const)(
    'maps Play evidence %s/%s/%s to %s confidence',
    (search, prefix, details, expected) => {
      expect(
        scoringConfidence('GOOGLE_PLAY', {
          ...evidence(search, prefix, details),
          suggestCompleted: false,
        }),
      ).toBe(expected);
    },
  );

  it('requires at least eight intended and successful detail lookups', () => {
    const base = evidence(true, true, true);
    expect(
      scoringConfidence('GOOGLE_PLAY', {
        ...base,
        detailTargetCount: 7,
        detailSuccessCount: 8,
      }),
    ).toBe('MEDIUM');
    expect(
      scoringConfidence('GOOGLE_PLAY', {
        ...base,
        detailTargetCount: 10,
        detailSuccessCount: 7,
      }),
    ).toBe('MEDIUM');
  });

  it('maps each store to its source and formula version', () => {
    expect(scoringProfile('APP_STORE')).toEqual({
      source: 'APPLE_SUGGEST_SEARCH',
      formulaVersion: 'app-store-v1',
    });
    expect(scoringProfile('GOOGLE_PLAY')).toEqual({
      source: 'GOOGLE_PLAY_PREFIX_SEARCH',
      formulaVersion: 'google-play-v1',
    });
  });
});
