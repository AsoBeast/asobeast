import { describe, expect, it } from 'vitest';
import { KEYWORD_BULK_ADD_LIMIT, KEYWORD_IMPORT_LIMIT } from '../aso';
import {
  KEYWORD_IMPORT_REASONS,
  KEYWORD_IMPORT_STATUSES,
  keywordLabel,
  type KeywordImportSummary,
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
