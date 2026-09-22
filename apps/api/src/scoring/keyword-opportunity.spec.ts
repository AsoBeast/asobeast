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
  ...overrides,
});

describe('appOpportunity', () => {
  it('resolves relevance, both display scales and the opportunity', () => {
    expect(appOpportunity(input())).toEqual({
      relevance: 100,
      volume: expect.closeTo(47.7, 6) as number,
      difficulty100: expect.closeTo(43.7, 6) as number,
      opportunity: 34,
    });
  });

  it('prefers a manual relevance and keeps it out of the opportunity', () => {
    expect(appOpportunity(input({ relevanceOverride: 55 }))).toMatchObject({
      relevance: 55,
      opportunity: 34,
    });
  });

  it('has no opportunity for an unscored keyword', () => {
    expect(appOpportunity(input({ traffic: null, difficulty: null }))).toEqual({
      relevance: 100,
      volume: null,
      difficulty100: null,
      opportunity: null,
    });
  });
});
