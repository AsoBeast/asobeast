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

  it('summarizes a drop that followed no change of yours', () => {
    expect(
      summarizeActionEvidence({
        rule: 'rank.investigate_unexplained_drop',
        country: 'us',
        visibilityBefore: 40,
        visibilityAfter: 32.5,
        visibilityDelta: 7.5,
        windowDays: 14,
        trackedKeywords: 5,
        droppedKeywords: [],
        meanVolatility: 10,
        lastOwnChangeAt: null,
      }),
    ).toBe('visibility 40 → 32.5 with no change of yours, 0 keywords fell');
  });

  it('counts the store rule problems in a listing field', () => {
    const lint = {
      rule: 'metadata.fix_lint' as const,
      field: 'title' as const,
      chars: 34,
      limit: 30,
      issues: [
        {
          rule: 'over-limit',
          message: 'Exceeds the 30 character limit (34).',
          offendingText: null,
        },
      ],
    };

    expect(summarizeActionEvidence(lint)).toBe(
      '1 store rule problem in title, 34/30 characters',
    );
    expect(
      summarizeActionEvidence({
        ...lint,
        issues: [...lint.issues, { ...lint.issues[0], rule: 'emoji' }],
      }),
    ).toBe('2 store rule problems in title, 34/30 characters');
  });
});
