import { Store } from '@prisma/client';
import {
  LintContext,
  MetadataAuditResult,
  TrackedKeywordItem,
} from '@asobeast/shared';
import { buildAssistantContext, validateDrafts } from './metadata-drafts';

const EMPTY_CONTEXT: LintContext = {
  titleWords: [],
  subtitleWords: [],
  brandTokens: [],
  competitorNames: [],
  trackedKeywords: [],
};

const makeKw = (
  text: string,
  volume: number,
  difficulty: number,
): TrackedKeywordItem => ({
  keywordId: text,
  text,
  country: 'us',
  source: 'MANUAL',
  active: true,
  latestPosition: null,
  previousPosition: null,
  positionDelta1d: null,
  positionDelta7d: null,
  traffic: null,
  difficulty,
  volume,
  relevance: 100,
  opportunity: null,
  bucket: null,
  scoredAt: null,
  scoreProvenance: null,
  serpVolatility7d: null,
});

const audit: MetadataAuditResult = {
  appId: 'app-1',
  store: 'APP_STORE',
  fields: [
    {
      field: 'title',
      value: 'Habit Tracker',
      chars: 13,
      limit: 30,
      indexed: true,
      issues: [],
    },
    {
      field: 'subtitle',
      value: 'Streaks',
      chars: 7,
      limit: 30,
      indexed: true,
      issues: [],
    },
  ],
  coverage: [
    {
      keywordId: 'k1',
      text: 'daily goals',
      bucket: null,
      fields: [],
      uncovered: true,
    },
    {
      keywordId: 'k2',
      text: 'habit tracker',
      bucket: null,
      fields: [],
      uncovered: false,
    },
  ],
  keywordFieldSuggestion: null,
};

describe('validateDrafts', () => {
  it('keeps requested fields, clamps to the limit, lints and dedupes', () => {
    const drafts = validateDrafts(
      {
        drafts: [
          { field: 'title', value: 'x'.repeat(40), rationale: 'r' },
          { field: 'title', value: 'duplicate', rationale: 'r2' },
          { field: 'description', value: 'not requested', rationale: 'r' },
          { field: 'subtitle', value: 'Daily streak counter', rationale: 'ok' },
        ],
      },
      Store.APP_STORE,
      ['title', 'subtitle'],
      EMPTY_CONTEXT,
    );

    expect(drafts.map((draft) => draft.field)).toEqual(['title', 'subtitle']);
    const title = drafts.find((draft) => draft.field === 'title');
    expect(title?.value).toHaveLength(30);
    expect(title?.chars).toBe(30);
    expect(title?.limit).toBe(30);
    expect(Array.isArray(title?.issues)).toBe(true);
  });

  it('tolerates junk without throwing', () => {
    expect(
      validateDrafts(null, Store.APP_STORE, ['title'], EMPTY_CONTEXT),
    ).toEqual([]);
    expect(
      validateDrafts(
        { drafts: 'nope' },
        Store.APP_STORE,
        ['title'],
        EMPTY_CONTEXT,
      ),
    ).toEqual([]);
    expect(
      validateDrafts(
        { drafts: ['x', { field: 42 }] },
        Store.APP_STORE,
        ['title'],
        EMPTY_CONTEXT,
      ),
    ).toEqual([]);
  });
});

describe('buildAssistantContext', () => {
  it('includes rules, current values, ranked keywords, competitors and instructions', () => {
    const text = buildAssistantContext(
      Store.APP_STORE,
      ['title', 'subtitle'],
      audit,
      [makeKw('daily goals', 10, 5), makeKw('habit tracker', 8, 3)],
      ['Rival App'],
      'be playful',
    );

    expect(text).toContain('Habit Tracker');
    expect(text).toContain('daily goals');
    expect(text).toContain('uncovered');
    expect(text).toContain('Rival App');
    expect(text).toContain('Owner instructions: be playful');
    expect(text).toContain('Draft these fields only: title, subtitle');
  });
});
