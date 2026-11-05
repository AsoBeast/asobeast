import { describe, expect, it } from 'vitest';
import {
  COMPETITOR_THREAT_KINDS,
  CompetitorGapKeyword,
  CompetitorGaps,
  GAP_TOP,
  GAP_YOU_BELOW,
  THREAT_WINDOW_DAYS,
  THREAT_WITHIN,
  WINNABLE_COMPETITOR_FROM,
} from './competitors';

const threat = {
  keywordId: 'kw-1',
  text: 'habit tracker',
  volume: 40,
  difficulty: 30,
  opportunity: 55,
  yourPosition: 8,
  bestCompetitorPosition: 10,
  bestCompetitorId: 'app-rival',
  gap: null,
  country: 'us',
  lastCheckedOn: '2026-11-04',
  threat: 'closing',
  competitorDelta: 3,
  overtookOn: null,
} satisfies CompetitorGapKeyword;

const gaps = {
  theyRankYouDont: [],
  youRankTheyDont: [],
  outranked: [],
  keywordGaps: [],
  winnable: [],
  threats: [threat],
  lead: [],
  coverage: {
    competitors: 2,
    delisted: 1,
    markets: [{ country: 'us', keywords: 3, compared: 2 }],
  },
} satisfies CompetitorGaps;

describe('gap thresholds', () => {
  it('names the values the lists are cut at', () => {
    expect({
      GAP_TOP,
      GAP_YOU_BELOW,
      WINNABLE_COMPETITOR_FROM,
      THREAT_WITHIN,
      THREAT_WINDOW_DAYS,
    }).toEqual({
      GAP_TOP: 30,
      GAP_YOU_BELOW: 100,
      WINNABLE_COMPETITOR_FROM: 11,
      THREAT_WITHIN: 3,
      THREAT_WINDOW_DAYS: 7,
    });
  });

  it('keeps the thresholds consistent with each other', () => {
    expect(WINNABLE_COMPETITOR_FROM).toBeLessThanOrEqual(GAP_TOP);
    expect(THREAT_WITHIN).toBeLessThan(GAP_TOP);
    expect(GAP_TOP).toBeLessThan(GAP_YOU_BELOW);
  });

  it('names the two kinds of threat', () => {
    expect(COMPETITOR_THREAT_KINDS).toEqual(['closing', 'overtook']);
    expect(gaps.threats[0]?.threat).toBe('closing');
  });
});
