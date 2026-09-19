import { describe, expect, it } from 'vitest';

import {
  keywordFieldBytes,
  keywordFieldChars,
  packKeywordField,
  parseKeywordField,
} from './keyword-field';

describe('keywordFieldBytes', () => {
  it('counts the stored field in UTF-8 bytes the way App Store Connect does', () => {
    expect(keywordFieldBytes(['habit', 'tracker'])).toBe(13);
    expect(keywordFieldBytes(['zażółć', 'łódź'])).toBe(18);
    expect(keywordFieldBytes([])).toBe(0);
  });
});

describe('packKeywordField', () => {
  it('keeps whole phrases in order while the field fits 100 bytes', () => {
    const packed = packKeywordField([
      'ą'.repeat(40),
      'ę'.repeat(20),
      'ab',
      'c',
    ]);

    expect(packed).toEqual(['ą'.repeat(40), 'ab', 'c']);
    expect(keywordFieldBytes(packed)).toBeLessThanOrEqual(100);
  });

  it('keeps a field that lands exactly on the limit', () => {
    expect(packKeywordField(['ą'.repeat(50)])).toEqual(['ą'.repeat(50)]);
    expect(packKeywordField(['a'.repeat(99) + 'ą'])).toEqual([]);
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
});
