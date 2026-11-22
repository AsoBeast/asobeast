import { describe, expect, it } from 'vitest';

import { pluralsOf } from './plurals';

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
