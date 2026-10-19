import { describe, expect, it } from 'vitest';

import { countChars, KEYWORD_FIELD_CHAR_LIMIT, truncateChars } from './limits';

describe('KEYWORD_FIELD_CHAR_LIMIT', () => {
  it('is the 100 characters App Store Connect accepts', () => {
    expect(KEYWORD_FIELD_CHAR_LIMIT).toBe(100);
  });
});

describe('countChars', () => {
  it('counts nothing for an empty string and plain text one each', () => {
    expect(countChars('')).toBe(0);
    expect(countChars('habit tracker')).toBe(13);
  });

  it('counts a character outside the bmp once', () => {
    expect(countChars('𠮷')).toBe(1);
    expect(countChars('𠮷野家,𪚥𪚥𪚥')).toBe(7);
  });

  it('counts an accented or cjk letter in the bmp once', () => {
    expect(countChars('zażółć')).toBe(6);
    expect(countChars('番茄钟')).toBe(3);
  });

  it('counts an emoji sequence by its code points', () => {
    expect(countChars('😀')).toBe(1);
    expect(countChars('🇵🇱')).toBe(2);
    expect(countChars('❤\uFE0F')).toBe(2);
    expect(countChars('👨‍👩‍👧')).toBe(5);
  });

  it('counts a combining mark as its own unit', () => {
    expect(countChars('é')).toBe(2);
    expect(countChars('ą'.normalize('NFD'))).toBe(2);
  });

  it('counts a lone surrogate once', () => {
    expect(countChars('a\uD800b')).toBe(3);
    expect(countChars('\uDC00\uD800')).toBe(2);
  });

  it('agrees with the code point iterator', () => {
    const text = 'a𠮷b😀\uD800c\uDC00𪚥';

    expect(countChars(text)).toBe([...text].length);
  });
});

describe('truncateChars', () => {
  it('keeps the first characters and never splits a surrogate pair', () => {
    expect(truncateChars('𠮷野家,𪚥𪚥𪚥', 4)).toBe('𠮷野家,');
    expect(truncateChars('😀'.repeat(5), 3)).toBe('😀😀😀');
  });

  it('returns the whole text when it fits', () => {
    expect(truncateChars('abc', 3)).toBe('abc');
    expect(truncateChars('abc', 10)).toBe('abc');
    expect(truncateChars('', 5)).toBe('');
  });

  it('returns nothing for a limit of zero or less', () => {
    expect(truncateChars('abc', 0)).toBe('');
    expect(truncateChars('abc', -1)).toBe('');
  });

  it('cuts at exactly the count countChars reports', () => {
    const text = '𠮷野家,𪚥𪚥𪚥 ab😀';

    for (let limit = 0; limit <= countChars(text); limit += 1) {
      expect(countChars(truncateChars(text, limit))).toBe(limit);
    }
  });
});
