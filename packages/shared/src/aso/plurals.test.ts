import { describe, expect, it } from 'vitest';

import { isPluralOf, NOT_PLURALS, pluralsOf } from './plurals';

describe('pluralsOf', () => {
  it.each([
    ['map', ['map', 'maps']],
    ['box', ['box', 'boxs', 'boxes']],
    ['quiz', ['quiz', 'quizs', 'quizes', 'quizzes']],
    ['category', ['category', 'categorys', 'categories']],
    ['day', ['day', 'days']],
  ])('%s', (word, forms) => {
    expect(pluralsOf(word)).toEqual(forms);
  });
});

describe('isPluralOf', () => {
  it.each([
    ['habits', 'habit'],
    ['boxes', 'box'],
    ['cities', 'city'],
    ['buses', 'bus'],
    ['glasses', 'glass'],
  ])('reads %s as a plural of %s', (word, singular) => {
    expect(isPluralOf(word, singular)).toBe(true);
  });

  it.each([
    ['news', 'new'],
    ['series', 'serie'],
    ['analytics', 'analytic'],
    ['species', 'specie'],
    ['habit', 'habit'],
    ['ios', 'io'],
    ['its', 'it'],
    ['boss', 'bos'],
  ])('never reads %s as a plural of %s', (word, singular) => {
    expect(isPluralOf(word, singular)).toBe(false);
  });

  it('knows the words that only end in s', () => {
    expect([...NOT_PLURALS]).toEqual([
      'news',
      'series',
      'species',
      'means',
      'analytics',
      'physics',
      'politics',
      'ethics',
      'economics',
      'mathematics',
      'athletics',
      'gymnastics',
      'logistics',
    ]);
  });
});
