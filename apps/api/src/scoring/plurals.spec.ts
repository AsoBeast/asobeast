import { pluralsOf, sameWord } from './plurals';

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

describe('sameWord', () => {
  it.each([
    ['quiz', 'quizzes', true],
    ['quizzes', 'quiz', true],
    ['categories', 'category', true],
    ['country', 'countries', true],
    ['map', 'maps', true],
    ['map', 'mapes', false],
    ['geo', 'geography', false],
    ['city', 'cities', true],
    ['cit', 'cities', false],
  ])('%s and %s', (a, b, expected) => {
    expect(sameWord(a, b)).toBe(expected);
  });
});
