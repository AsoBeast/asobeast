import { describe, expect, it } from 'vitest';

import type { ScoreProvenance } from './index';
import {
  DEFAULT_COUNTRY,
  isFloorAnswer,
  isOfficialPopularityState,
  isStoreSuggestionStrategy,
  KEYWORD_SUGGESTION_STRATEGIES,
  OFFICIAL_POPULARITY_STATES,
  STORE_SUGGESTION_STRATEGIES,
  isScoringConfidence,
  isScoringSource,
  SCORING_CONFIDENCES,
  SCORING_SOURCES,
  SERP_CAPTURE_DEPTH,
  SERP_DEPTH,
  STORES,
  SUPPORTED_STORES,
} from './index';

describe('@asobeast/shared constants', () => {
  it('supports both stores in this version', () => {
    expect(SUPPORTED_STORES).toEqual(['APP_STORE', 'GOOGLE_PLAY']);
  });

  it('knows both stores in the union', () => {
    expect(STORES).toContain('APP_STORE');
    expect(STORES).toContain('GOOGLE_PLAY');
  });

  it('defaults to the US region', () => {
    expect(DEFAULT_COUNTRY).toBe('us');
  });

  it('captures the top 50 search results, never fewer than the top 10', () => {
    expect(SERP_CAPTURE_DEPTH).toBe(50);
    expect(SERP_CAPTURE_DEPTH).toBeGreaterThanOrEqual(SERP_DEPTH);
  });

  it('exposes a closed scoring provenance vocabulary', () => {
    expect(SCORING_SOURCES).toEqual([
      'APPLE_SUGGEST_SEARCH',
      'GOOGLE_PLAY_PREFIX_SEARCH',
      'APPLE_SUGGEST_REACH',
      'GOOGLE_PLAY_SUGGEST_REACH',
      'APPLE_ADS_POPULARITY',
      'APPLE_SEARCH_SIGNALS',
    ]);
    expect(SCORING_CONFIDENCES).toEqual(['LOW', 'MEDIUM', 'HIGH']);
    expect(isScoringSource('APPLE_SUGGEST_SEARCH')).toBe(true);
    expect(isScoringSource('SEARCH')).toBe(false);
    expect(isScoringConfidence('HIGH')).toBe(true);
    expect(isScoringConfidence('UNKNOWN')).toBe(false);
  });

  it('names the three answers Apple can give for a term', () => {
    expect(OFFICIAL_POPULARITY_STATES).toEqual(['listed', 'floor', 'absent']);
  });

  it.each(['listed', 'floor', 'absent'])(
    'recognises %s as an official popularity state',
    (state) => {
      expect(isOfficialPopularityState(state)).toBe(true);
    },
  );

  it.each(['below', '', null, 5])(
    'refuses %p as an official popularity state',
    (value) => {
      expect(isOfficialPopularityState(value)).toBe(false);
    },
  );

  it.each(['floor', 'absent'] as const)(
    'reads %s as a floor answer',
    (state) => {
      expect(isFloorAnswer(state)).toBe(true);
    },
  );

  it.each(['listed', null, undefined] as const)(
    'does not read %p as a floor answer',
    (state) => {
      expect(isFloorAnswer(state)).toBe(false);
    },
  );

  it('round-trips a UTC provenance timestamp', () => {
    const provenance: ScoreProvenance = {
      source: 'GOOGLE_PLAY_PREFIX_SEARCH',
      formulaVersion: 'google-play-v1',
      capturedAt: '2026-07-28T12:30:45.000Z',
      confidence: 'MEDIUM',
    };

    expect(new Date(provenance.capturedAt).toISOString()).toBe(
      provenance.capturedAt,
    );
  });
});

describe('store suggestion strategies', () => {
  it('names the strategies that reach the store', () => {
    expect(STORE_SUGGESTION_STRATEGIES).toEqual([
      'search',
      'similar',
      'developer',
      'competitorSearch',
    ]);
    for (const strategy of STORE_SUGGESTION_STRATEGIES) {
      expect(KEYWORD_SUGGESTION_STRATEGIES).toContain(strategy);
    }
    expect(isStoreSuggestionStrategy('similar')).toBe(true);
    for (const value of ['metadata', 'seasonal', 'nope']) {
      expect(isStoreSuggestionStrategy(value)).toBe(false);
    }
  });
});

describe('keyword suggestion strategies', () => {
  it('appends competitorSearch after every released strategy', () => {
    expect(KEYWORD_SUGGESTION_STRATEGIES.slice(0, 7)).toEqual([
      'metadata',
      'search',
      'similar',
      'developer',
      'competitors',
      'seasonal',
      'reviews',
    ]);
    expect(KEYWORD_SUGGESTION_STRATEGIES.at(-1)).toBe('competitorSearch');
  });

  it('competitorSearch reaches the store', () => {
    expect(isStoreSuggestionStrategy('competitorSearch')).toBe(true);
  });
});
