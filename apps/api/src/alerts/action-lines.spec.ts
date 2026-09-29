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

  it('names the competitor that changed its listing and passed you', () => {
    expect(
      summarizeActionEvidence({
        rule: 'competitor.investigate_overtake',
        competitorAppId: 'comp_1',
        competitorName: null,
        changedAt: '2026-07-27',
        fields: ['title', 'subtitle'],
        newTitle: null,
        newSubtitle: null,
        keywords: [],
      }),
    ).toBe(
      'a competitor changed title, subtitle on 2026-07-27 and passed you on 0 keywords',
    );
  });

  it('compares recent review scores with the baseline', () => {
    expect(
      summarizeActionEvidence({
        rule: 'reviews.investigate_rating_decline',
        recentAverage: 3.5,
        baselineAverage: 4.5,
        drop: 1,
        recentReviews: 8,
        baselineReviews: 6,
        recentDays: 14,
        baselineDays: 21,
        latestVersion: '4.2.0',
        negativeShare: 0.25,
        sampleReviewIds: [],
      }),
    ).toBe('review scores 4.5 → 3.5 over 8 recent reviews');
  });

  it('counts the low reviews still waiting for a reply', () => {
    expect(
      summarizeActionEvidence({
        rule: 'reviews.reply_negative',
        unanswered: 3,
        checked: 4,
        negative: 4,
        windowDays: 14,
        oldestUnansweredAt: '2026-07-21T03:00:00.000Z',
        replyRate: 0.25,
        sampleReviewIds: [],
      }),
    ).toBe('3 of 4 checked low reviews have no reply in 14 days');
  });

  it('states how old the listing is against its competitors', () => {
    expect(
      summarizeActionEvidence({
        rule: 'listing.ship_update',
        storeUpdatedAt: '2026-03-10T00:00:00.000Z',
        daysSinceUpdate: 142,
        version: '3.1.0',
        competitorMedianDays: null,
        competitorsCompared: 0,
      }),
    ).toBe('last store update 142 days ago');
  });

  it('adds the competitor median when rivals were compared', () => {
    expect(
      summarizeActionEvidence({
        rule: 'listing.ship_update',
        storeUpdatedAt: '2026-03-10T00:00:00.000Z',
        daysSinceUpdate: 142,
        version: '3.1.0',
        competitorMedianDays: 25,
        competitorsCompared: 3,
      }),
    ).toBe('last store update 142 days ago, competitor median 25 days');
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
