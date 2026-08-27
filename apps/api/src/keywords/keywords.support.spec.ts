import { BadRequestException } from '@nestjs/common';
import { normalizeKeyword } from './keywords.support';

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
