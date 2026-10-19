import {
  INFLECTION_STEM_CHARS,
  pluralsOf,
  sameStem,
  sameWord,
} from './plurals';

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

describe('sameStem', () => {
  it.each([
    ['тревожности', 'тревожностью'],
    ['психолог', 'психология'],
    ['дневник', 'дневником'],
    ['тревожностьapp', 'тревожностьюapp'],
  ])('treats two case forms of %s and %s as the same word', (a, b) => {
    expect(sameStem(a, b)).toBe(true);
  });

  it.each([
    ['тревога', 'тревожность'],
    ['дневник', 'дневной'],
    ['география', 'геолог'],
    ['geo', 'география'],
    ['map', 'maps'],
    ['sleepcycleтрекер', 'sleepcyclehabit'],
    ['meditationнарусском', 'meditationдлясна'],
    ['sleepтрекер', 'sleepтрекинг'],
  ])('keeps %s and %s apart', (a, b) => {
    expect(sameStem(a, b)).toBe(false);
  });

  it(`needs ${INFLECTION_STEM_CHARS} shared characters in both words`, () => {
    expect(sameStem('тревог', 'тревогой')).toBe(false);
    expect(sameStem('тревогам', 'тревогами')).toBe(true);
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
    ['тревожности', 'тревожностью', true],
    ['тревожностью', 'тревожности', true],
    ['дневник', 'дневника', true],
    ['тревога', 'тревожность', false],
  ])('%s and %s', (a, b, expected) => {
    expect(sameWord(a, b)).toBe(expected);
  });
});
