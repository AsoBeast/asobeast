import { describe, expect, it } from 'vitest';

import { isStopword, normalizeText, STOPWORDS, tokenize } from './text';

describe('normalizeText', () => {
  it('lowercases input', () => {
    expect(normalizeText('Habit Tracker')).toBe('habit tracker');
  });

  it('strips punctuation and emoji', () => {
    expect(normalizeText('Streak🔥 Counter, Daily!')).toBe(
      'streak counter daily',
    );
  });

  it('collapses whitespace', () => {
    expect(normalizeText('  water   drink  ')).toBe('water drink');
  });

  it('returns empty string for pure noise', () => {
    expect(normalizeText('!!! 🔥 ---')).toBe('');
  });
});

describe('tokenize', () => {
  it('splits normalized text into tokens', () => {
    expect(tokenize('PDF Scanner & Document')).toEqual([
      'pdf',
      'scanner',
      'document',
    ]);
  });

  it('returns an empty array for empty input', () => {
    expect(tokenize('   ')).toEqual([]);
  });
});

describe('stopwords', () => {
  it('flags common English words', () => {
    expect(isStopword('the')).toBe(true);
    expect(isStopword('with')).toBe(true);
  });

  it('flags store noise words', () => {
    expect(isStopword('app')).toBe(true);
    expect(isStopword('free')).toBe(true);
    expect(isStopword('best')).toBe(true);
    expect(isStopword('new')).toBe(true);
    expect(isStopword('official')).toBe(true);
  });

  it('does not flag meaningful terms', () => {
    expect(isStopword('tracker')).toBe(false);
    expect(isStopword('game')).toBe(false);
  });

  it('has a substantial list', () => {
    expect(STOPWORDS.size).toBeGreaterThanOrEqual(120);
  });
});
