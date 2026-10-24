import { describe, expect, it } from 'vitest';
import {
  ANNOTATION_LABEL_MAX_LENGTH,
  ANNOTATION_TAG_MAX_LENGTH,
  ANNOTATION_TAG_RULE,
  isAnnotationTag,
  normalizeAnnotationLabel,
  normalizeAnnotationTag,
} from './annotations';

describe('normalizeAnnotationLabel', () => {
  it.each([
    ['  Release 5.21.0  ', 'Release 5.21.0'],
    ['DE   listing   wave', 'DE listing wave'],
    ['café  launch', 'café launch'],
  ])('normalizes %j to %j', (raw, expected) => {
    expect(normalizeAnnotationLabel(raw)).toBe(expected);
  });
});

describe('normalizeAnnotationTag', () => {
  it.each([
    [' Wave ', 'wave'],
    ['Q4  Push', 'q4 push'],
    ['café', 'café'],
  ])('normalizes %j to %j', (raw, expected) => {
    expect(normalizeAnnotationTag(raw)).toBe(expected);
  });
});

describe('isAnnotationTag', () => {
  it.each(['wave', 'q4-push', 'ab_1', 'हिंदी', 'ภาษาไทย'])(
    'accepts %s',
    (tag) => {
      expect(isAnnotationTag(tag)).toBe(true);
    },
  );

  it.each(['#hash', '-lead', '', 'a'.repeat(ANNOTATION_TAG_MAX_LENGTH + 1)])(
    'refuses %j',
    (tag) => {
      expect(isAnnotationTag(tag)).toBe(false);
    },
  );

  it('counts the length in code points', () => {
    expect(isAnnotationTag('𝒶'.repeat(ANNOTATION_TAG_MAX_LENGTH))).toBe(true);
  });
});

describe('annotation limits', () => {
  it('bounds labels and tags', () => {
    expect([ANNOTATION_LABEL_MAX_LENGTH, ANNOTATION_TAG_MAX_LENGTH]).toEqual([
      80, 24,
    ]);
  });
});

describe('ANNOTATION_TAG_RULE', () => {
  it('states the length and the first character rule the pattern enforces', () => {
    expect(ANNOTATION_TAG_RULE).toBe(
      `at most ${ANNOTATION_TAG_MAX_LENGTH} letters, numbers, spaces, hyphens or underscores and starts with a letter or number`,
    );
  });
});
