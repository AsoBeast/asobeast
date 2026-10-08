import { BadRequestException } from '@nestjs/common';
import { checkKeywordText, normalizeKeyword } from './keywords.support';

describe('normalizeKeyword', () => {
  it('normalizes casing and whitespace', () => {
    expect(normalizeKeyword('  Habit   Tracker ')).toBe('habit tracker');
  });

  it('rejects an empty keyword', () => {
    expect(() => normalizeKeyword('   ')).toThrow(BadRequestException);
  });

  it('rejects a single token longer than a store search box accepts', () => {
    expect(() => normalizeKeyword('b'.repeat(10_000))).toThrow(
      BadRequestException,
    );
  });

  it('rejects a keyword longer than five words', () => {
    expect(() => normalizeKeyword('one two three four five six')).toThrow(
      BadRequestException,
    );
  });
});

describe('checkKeywordText', () => {
  it('returns the normalized phrase of a valid keyword', () => {
    expect(checkKeywordText('  Habit   Tracker ')).toEqual({
      ok: true,
      text: 'habit tracker',
    });
  });

  it('reports an empty keyword with the message the endpoint always used', () => {
    expect(checkKeywordText(' !! ')).toEqual({
      ok: false,
      reason: 'empty',
      message: 'Keyword must not be empty',
    });
  });

  it('reports a phrase longer than a store search box accepts', () => {
    expect(checkKeywordText('b'.repeat(101))).toEqual({
      ok: false,
      reason: 'tooLong',
      message: 'Keyword exceeds 100 characters',
    });
  });

  it('reports a phrase of more than five words and names it', () => {
    expect(checkKeywordText('one two three four five six')).toEqual({
      ok: false,
      reason: 'tooManyWords',
      message: 'Keyword "one two three four five six" exceeds 5 words',
    });
  });

  it.each([
    ['ตัวจับเวลา', 'ตัวจับเวลา'],
    ['习惯追踪器', '习惯追踪器'],
    ['ZAŻÓŁĆ Gęślą', 'zażółć gęślą'],
  ])('keeps the letters of %s and counts it as written', (raw, expected) => {
    expect(checkKeywordText(raw)).toEqual({ ok: true, text: expected });
  });
});
