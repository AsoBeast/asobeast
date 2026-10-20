import { describe, expect, it } from 'vitest';

import {
  keywordFieldChars,
  packKeywordField,
  parseKeywordField,
} from './keyword-field';

describe('packKeywordField', () => {
  it('keeps whole phrases in order while the field fits 100 characters', () => {
    const packed = packKeywordField([
      'ą'.repeat(80),
      'ę'.repeat(20),
      'ab',
      'c',
    ]);

    expect(packed).toEqual(['ą'.repeat(80), 'ab', 'c']);
    expect(keywordFieldChars(packed)).toBeLessThanOrEqual(100);
  });

  it('keeps an accented field that lands exactly on the limit', () => {
    expect(packKeywordField(['ą'.repeat(100)])).toEqual(['ą'.repeat(100)]);
    expect(packKeywordField(['ą'.repeat(101)])).toEqual([]);
  });

  it('packs phrases that hold characters outside the bmp by characters', () => {
    const phrases = Array.from(
      { length: 15 },
      (_, index) => `𠮷野家${String.fromCodePoint(0x20000 + index)}𪚥𪚥`,
    );

    const packed = packKeywordField(phrases);

    expect(packed).toHaveLength(14);
    expect(keywordFieldChars(packed)).toBe(97);
  });
});

describe('parseKeywordField', () => {
  it('removes duplicates in first occurrence order and counts them', () => {
    expect(
      parseKeywordField('workout,fitness,workout,running,fitness'),
    ).toEqual({
      phrases: ['workout', 'fitness', 'running'],
      duplicatesRemoved: 2,
    });
  });

  it('drops whitespace and empty parts without counting them as duplicates', () => {
    expect(parseKeywordField(' fitness , ,, workout ,')).toEqual({
      phrases: ['fitness', 'workout'],
      duplicatesRemoved: 0,
    });
  });

  it('normalizes case, the dotted capital I and punctuation inside a phrase', () => {
    expect(
      parseKeywordField('Fitness,FITNESS,İstanbul Run,step-counter!'),
    ).toEqual({
      phrases: ['fitness', 'istanbul run', 'step counter'],
      duplicatesRemoved: 1,
    });
  });

  it('reads a decomposed field as the same phrases as a precomposed one', () => {
    const composed = 'zażółć,łódź,Zażółć';
    expect(parseKeywordField(composed.normalize('NFD'))).toEqual({
      phrases: ['zażółć', 'łódź'],
      duplicatesRemoved: 1,
    });
    expect(parseKeywordField(composed.normalize('NFD'))).toEqual(
      parseKeywordField(composed),
    );
  });

  it('reads nothing from an empty or comma only field', () => {
    expect(parseKeywordField('')).toEqual({
      phrases: [],
      duplicatesRemoved: 0,
    });
    expect(parseKeywordField(' , , ')).toEqual({
      phrases: [],
      duplicatesRemoved: 0,
    });
  });
});

describe('keywordFieldChars', () => {
  it('counts the commas the stored field joins with', () => {
    expect(keywordFieldChars(['fitness', 'workout', 'running'])).toBe(23);
  });

  it('counts nothing for no phrases and one phrase as itself', () => {
    expect(keywordFieldChars([])).toBe(0);
    expect(keywordFieldChars(['a'.repeat(100)])).toBe(100);
  });

  it('counts an accented or cjk letter once, as App Store Connect does', () => {
    expect(keywordFieldChars(['zażółć', 'łódź'])).toBe(11);
    expect(keywordFieldChars(['番茄钟', '冥想'])).toBe(6);
  });

  it('counts a character outside the bmp once, as the documented rule says', () => {
    expect(keywordFieldChars(['𠮷野家', '𪚥𪚥𪚥'])).toBe(7);
  });
});
