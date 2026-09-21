import { appOpportunity, OpportunityInput } from './keyword-opportunity';

const input = (
  overrides: Partial<OpportunityInput> = {},
): OpportunityInput => ({
  source: 'TITLE',
  keywordText: 'geo quiz',
  snapshotText: 'geo quiz world',
  relevanceOverride: null,
  traffic: 4.77,
  difficulty: 4.37,
  appRatingCount: null,
  medianTopTenRatings: null,
  ...overrides,
});

describe('appOpportunity', () => {
  it('resolves relevance, both display scales and the opportunity', () => {
    expect(appOpportunity(input())).toEqual({
      relevance: 100,
      volume: expect.closeTo(47.7, 6) as number,
      difficulty100: expect.closeTo(43.7, 6) as number,
      opportunity: 38.6,
    });
  });

  it('prefers a manual relevance', () => {
    expect(appOpportunity(input({ relevanceOverride: 55 })).relevance).toBe(55);
  });

  it('has no opportunity for an unscored keyword', () => {
    expect(appOpportunity(input({ traffic: null, difficulty: null }))).toEqual({
      relevance: 100,
      volume: null,
      difficulty100: null,
      opportunity: null,
    });
  });

  describe('chance against the top ten', () => {
    const row = (appRatingCount: number, median: number | null) =>
      appOpportunity(
        input({
          relevanceOverride: 90,
          appRatingCount,
          medianTopTenRatings: median,
        }),
      ).opportunity;

    it('reads a keyword harder for a small app', () => {
      expect(row(4, 21_500)).toBe(28.1);
    });

    it('reads a keyword easier for a large app', () => {
      expect(row(2_000_000, 21_500)).toBe(39.3);
    });

    it('does not shift without a median', () => {
      expect(row(4, null)).toBe(34.7);
    });
  });
});
