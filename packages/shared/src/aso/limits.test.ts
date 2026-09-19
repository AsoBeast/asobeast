import { describe, expect, it } from 'vitest';

import {
  fieldLength,
  KEYWORD_FIELD_BYTE_LIMIT,
  utf8ByteLength,
} from './limits';

describe('KEYWORD_FIELD_BYTE_LIMIT', () => {
  it('is the 100 bytes App Store Connect accepts', () => {
    expect(KEYWORD_FIELD_BYTE_LIMIT).toBe(100);
  });
});

describe('fieldLength', () => {
  it('counts the keyword field in bytes and every other field in characters', () => {
    expect(fieldLength('keywordField', 'zażółć')).toBe(10);
    expect(fieldLength('title', 'zażółć')).toBe(6);
    expect(fieldLength('shortDescription', 'ą')).toBe(1);
  });
});

describe('utf8ByteLength', () => {
  it.each([
    ['habit,tracker', 13],
    ['ą', 2],
    ['日本', 6],
    ['🎯', 4],
    ['', 0],
  ])('counts %s as %i bytes', (text, bytes) => {
    expect(utf8ByteLength(text)).toBe(bytes);
  });
});
