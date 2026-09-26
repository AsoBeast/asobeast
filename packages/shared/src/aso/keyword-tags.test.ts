import { describe, expect, it } from 'vitest';
import { normalizeText } from '../text';
import {
  isKeywordTag,
  KEYWORD_NOTE_MAX_LENGTH,
  KEYWORD_TAG_MAX_LENGTH,
  KEYWORD_TAGS_MAX,
  normalizeKeywordNote,
  normalizeKeywordTag,
  normalizeKeywordTags,
  SUGGESTED_KEYWORD_TAGS,
} from './keyword-tags';

describe('normalizeKeywordTag', () => {
  it.each([
    [' Core ', 'core'],
    ['Exam  Season', 'exam season'],
    ['café', 'café'],
  ])('normalizes %j to %j', (raw, expected) => {
    expect(normalizeKeywordTag(raw)).toBe(expected);
  });

  it('folds a dotted capital I the way keyword text does', () => {
    expect(normalizeKeywordTag('İstanbul')).toBe(normalizeText('İstanbul'));
  });
});

describe('normalizeKeywordTags', () => {
  it('drops empty tags and keeps the first of each duplicate in order', () => {
    expect(normalizeKeywordTags(['Core', 'core', ' ', 'brand'])).toEqual([
      'core',
      'brand',
    ]);
  });
});

describe('isKeywordTag', () => {
  it.each(['core', 'exam-season', 'ab_1', 'हिंदी', 'ภาษาไทย'])(
    'accepts %s',
    (tag) => {
      expect(isKeywordTag(tag)).toBe(true);
    },
  );

  it.each(['#hash', '-lead', '', 'a'.repeat(KEYWORD_TAG_MAX_LENGTH + 1)])(
    'refuses %j',
    (tag) => {
      expect(isKeywordTag(tag)).toBe(false);
    },
  );

  it('counts the length in code points', () => {
    expect(isKeywordTag('𝒶'.repeat(KEYWORD_TAG_MAX_LENGTH))).toBe(true);
  });
});

describe('normalizeKeywordNote', () => {
  it('trims a note', () => {
    expect(normalizeKeywordNote('  x  ')).toBe('x');
  });

  it.each(['   ', '', null])('stores %j as no note', (raw) => {
    expect(normalizeKeywordNote(raw)).toBeNull();
  });
});

describe('keyword tag limits', () => {
  it('bounds tags and notes', () => {
    expect([
      KEYWORD_TAG_MAX_LENGTH,
      KEYWORD_TAGS_MAX,
      KEYWORD_NOTE_MAX_LENGTH,
    ]).toEqual([24, 8, 500]);
  });

  it('suggests only valid tags', () => {
    expect(SUGGESTED_KEYWORD_TAGS).toEqual(['brand', 'core', 'testing']);
    expect(SUGGESTED_KEYWORD_TAGS.every(isKeywordTag)).toBe(true);
  });
});
