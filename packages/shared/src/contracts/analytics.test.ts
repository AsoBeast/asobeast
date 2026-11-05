import { describe, expect, it } from 'vitest';
import {
  AppSummary,
  SHARE_OF_VOICE_REASONS,
  ShareOfVoice,
  VISIBILITY_COMPARISONS,
  VisibilityHistory,
} from './analytics';

const share = {
  current: 42,
  delta7d: -1.5,
  competitors: 2,
} satisfies ShareOfVoice;

const summary = {
  visibility: { current: 33.4, delta7d: null, delta30d: null },
  rankDistribution: {
    top1: 0,
    top3: 1,
    top10: 0,
    top50: 1,
    beyond: 0,
    unranked: 1,
  },
  movers: { up: [], down: [] },
  coverage: {
    inTitle: 0,
    inSubtitle: 0,
    inDescription: 0,
    uncoveredHighOpportunity: [],
  },
  lastRefreshAt: null,
  trackedKeywords: 3,
  competitors: 2,
  shareOfVoice: share,
  nonBrandedShareOfVoice: {
    current: null,
    delta7d: null,
    competitors: 0,
    reason: 'noCompetitors',
  },
} satisfies AppSummary;

const history = {
  points: [{ date: '2026-11-04', visibility: 33.4 }],
  shareOfVoice: [{ date: '2026-11-04', share: 42, competitors: 2 }],
  nonBrandedShareOfVoice: [],
} satisfies VisibilityHistory;

describe('share of voice contract', () => {
  it('names why a share cannot be measured', () => {
    expect(SHARE_OF_VOICE_REASONS).toEqual([
      'noCompetitors',
      'notChecked',
      'nobodyRanks',
    ]);
    expect(summary.nonBrandedShareOfVoice.reason).toBe('noCompetitors');
  });

  it('names the comparisons the visibility history answers', () => {
    expect(VISIBILITY_COMPARISONS).toEqual(['competitors']);
    expect(history.shareOfVoice[0]?.competitors).toBe(2);
  });
});
