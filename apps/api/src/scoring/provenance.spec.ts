import {
  scoringConfidence,
  ScoringEvidence,
  scoringProfile,
} from './provenance';

const evidence = (
  overrides: Partial<ScoringEvidence> = {},
): ScoringEvidence => ({
  searchResultCount: 100,
  suggestCompleted: true,
  suggestRequests: 4,
  detailTargetCount: 0,
  detailSuccessCount: 0,
  officialPopularityUsed: false,
  ...overrides,
});

describe('scoringConfidence', () => {
  it.each([
    ['GOOGLE_PLAY', 'LOW'],
    ['APP_STORE', 'HIGH'],
  ] as const)(
    'without suggest evidence %s is %s, only google play traffic reads it',
    (store, expected) => {
      expect(
        scoringConfidence(
          store,
          evidence({
            suggestCompleted: false,
            detailTargetCount: 10,
            detailSuccessCount: 10,
          }),
        ),
      ).toBe(expected);
    },
  );

  it.each([
    [evidence({ searchResultCount: 0 }), 'LOW'],
    [evidence({ searchResultCount: 9 }), 'MEDIUM'],
    [evidence({ searchResultCount: 10 }), 'HIGH'],
    [evidence({ searchResultCount: 0, officialPopularityUsed: true }), 'HIGH'],
  ])('%j on the app store is %s', (input, expected) => {
    expect(scoringConfidence('APP_STORE', input)).toBe(expected);
  });

  it('wants eight enriched details on google play', () => {
    expect(
      scoringConfidence(
        'GOOGLE_PLAY',
        evidence({ detailTargetCount: 10, detailSuccessCount: 7 }),
      ),
    ).toBe('MEDIUM');
    expect(
      scoringConfidence(
        'GOOGLE_PLAY',
        evidence({ detailTargetCount: 10, detailSuccessCount: 8 }),
      ),
    ).toBe('HIGH');
  });
});

describe('scoringProfile', () => {
  it('maps each store to its estimate source and v2 formula version', () => {
    expect(scoringProfile('APP_STORE', false)).toEqual({
      source: 'APPLE_SEARCH_SIGNALS',
      formulaVersion: 'app-store-v2',
    });
    expect(scoringProfile('GOOGLE_PLAY', false)).toEqual({
      source: 'GOOGLE_PLAY_SUGGEST_REACH',
      formulaVersion: 'google-play-v2',
    });
  });

  it('names apple ads when the official value was used', () => {
    expect(scoringProfile('APP_STORE', true)).toEqual({
      source: 'APPLE_ADS_POPULARITY',
      formulaVersion: 'app-store-v2',
    });
  });
});
