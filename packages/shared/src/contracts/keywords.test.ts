import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  KEYWORD_BULK_ADD_LIMIT,
  KEYWORD_BULK_CHANGE_LIMIT,
  KEYWORD_IMPORT_LIMIT,
} from '../aso';
import { KEYWORD_SORTS, type OfficialPopularityState } from '../index';
import {
  KEYWORD_BULK_ACTIONS,
  KEYWORD_IMPORT_REASONS,
  KEYWORD_IMPORT_STATUSES,
  keywordLabel,
  type KeywordImportSummary,
  type OfficialPopularityListing,
  type PlayAcquisitions,
  type ScoreSignals,
  type TrackedKeywordItem,
} from './keywords';

describe('keywordLabel', () => {
  it('appends the market in upper case when a country is scoped', () => {
    expect(keywordLabel({ text: 'habit tracker', country: 'us' })).toBe(
      'habit tracker (US)',
    );
  });

  it('returns the text alone when no country is scoped', () => {
    expect(keywordLabel({ text: 'habit tracker' })).toBe('habit tracker');
  });

  it('treats an empty country as no market rather than an empty suffix', () => {
    expect(keywordLabel({ text: 'habit tracker', country: '' })).toBe(
      'habit tracker',
    );
  });
});

describe('the keyword bulk change contract', () => {
  it('holds as many ids as an import holds rows', () => {
    expect(KEYWORD_BULK_CHANGE_LIMIT).toBe(500);
    expect(KEYWORD_BULK_CHANGE_LIMIT).toBe(KEYWORD_IMPORT_LIMIT);
  });

  it('names the three actions once each', () => {
    expect(KEYWORD_BULK_ACTIONS).toEqual(['pause', 'resume', 'untrack']);
    expect(new Set(KEYWORD_BULK_ACTIONS).size).toBe(
      KEYWORD_BULK_ACTIONS.length,
    );
  });
});

describe('the keyword sorts', () => {
  it('keeps the original sorts in place and appends the new ones', () => {
    expect(KEYWORD_SORTS.slice(0, 5)).toEqual([
      'opportunity',
      'traffic',
      'difficulty',
      'position',
      'volatility',
    ]);
    expect(KEYWORD_SORTS).toContain('added');
    expect(KEYWORD_SORTS).toContain('competitors');
  });
});

describe('the keyword import contract', () => {
  it('lists every row status once, importable ones first', () => {
    expect(KEYWORD_IMPORT_STATUSES).toEqual([
      'new',
      'resume',
      'tracked',
      'duplicate',
      'invalid',
      'overQuota',
    ]);
  });

  it('lists every invalid reason once', () => {
    expect(new Set(KEYWORD_IMPORT_REASONS).size).toBe(
      KEYWORD_IMPORT_REASONS.length,
    );
    expect(KEYWORD_IMPORT_REASONS).toContain('unknownCountry');
  });

  it('keeps one import to a body the API reads and a plan can use', () => {
    expect(KEYWORD_IMPORT_LIMIT).toBe(500);
    expect(KEYWORD_IMPORT_LIMIT).toBeGreaterThan(KEYWORD_BULK_ADD_LIMIT);
  });

  it('counts a row under every status in a summary', () => {
    const summary: KeywordImportSummary = {
      rows: 6,
      new: 1,
      resume: 1,
      tracked: 1,
      duplicate: 1,
      invalid: 1,
      overQuota: 1,
    };
    const counted = KEYWORD_IMPORT_STATUSES.reduce(
      (total, status) => total + summary[status],
      0,
    );
    expect(counted).toBe(summary.rows);
  });
});

describe('play acquisitions', () => {
  it('keeps play acquisitions optional on a tracked keyword', () => {
    expectTypeOf<TrackedKeywordItem['playAcquisitions']>().toEqualTypeOf<
      PlayAcquisitions | null | undefined
    >();
    expectTypeOf<PlayAcquisitions>().toEqualTypeOf<{
      month: string;
      visitors: number;
      acquisitions: number;
    }>();
  });
});

describe('the score signals contract', () => {
  it('keeps the floor answer members optional', () => {
    const legacy: ScoreSignals = {
      suggestReach: 'hit',
      suggestPrefixLength: 3,
      suggestPosition: 1,
      serpRelevance: 0.8,
      medianRatingCount: 1200,
      flags: [],
      officialPopularity: null,
      estimatedTraffic: 40,
      entryDifficulty: 30,
    };

    expect(legacy.officialPopularityState).toBeUndefined();
  });

  it('types the floor answer members', () => {
    expectTypeOf<ScoreSignals['officialPopularityState']>().toEqualTypeOf<
      OfficialPopularityState | null | undefined
    >();
    expectTypeOf<
      ScoreSignals['officialPopularityLastAboveFloor']
    >().toEqualTypeOf<OfficialPopularityListing | null | undefined>();
    expectTypeOf<ScoreSignals['officialPopularity']>().toEqualTypeOf<
      number | null
    >();
  });
});
