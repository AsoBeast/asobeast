import { describe, expect, it } from 'vitest';

import type { ScoreProvenance } from './index';
import {
  DEFAULT_COUNTRY,
  isScoringConfidence,
  isScoringSource,
  SCORING_CONFIDENCES,
  SCORING_SOURCES,
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

  it('exposes a closed scoring provenance vocabulary', () => {
    expect(SCORING_SOURCES).toEqual([
      'APPLE_SUGGEST_SEARCH',
      'GOOGLE_PLAY_PREFIX_SEARCH',
    ]);
    expect(SCORING_CONFIDENCES).toEqual(['LOW', 'MEDIUM', 'HIGH']);
    expect(isScoringSource('APPLE_SUGGEST_SEARCH')).toBe(true);
    expect(isScoringSource('SEARCH')).toBe(false);
    expect(isScoringConfidence('HIGH')).toBe(true);
    expect(isScoringConfidence('UNKNOWN')).toBe(false);
  });

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
