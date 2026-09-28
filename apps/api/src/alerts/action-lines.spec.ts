import { summarizeActionEvidence } from './action-lines';

describe('summarizeActionEvidence', () => {
  it('summarizes a keyword held just outside the top 10', () => {
    expect(
      summarizeActionEvidence({
        rule: 'keyword.push_to_top10',
        latestPosition: 12,
        bestPosition: 11,
        daysInBand: 6,
        windowDays: 7,
        volume: 60,
        relevance: 80,
        opportunity: 44,
        coveredFields: ['keywordField'],
        strongFields: ['title', 'subtitle'],
      }),
    ).toBe('position 12, 6/7 days in 11 to 20, covered only in keywordField');
  });
});
