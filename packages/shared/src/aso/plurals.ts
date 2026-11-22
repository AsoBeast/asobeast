const ES_STEM = /(s|x|z|ch|sh|o)$/;
const CONSONANT_Y = /[^aeiou]y$/;
const SINGLE_Z = /[aeiou]z$/;

export function pluralsOf(word: string): string[] {
  const forms = [word, `${word}s`];
  if (ES_STEM.test(word)) {
    forms.push(`${word}es`);
  }
  if (SINGLE_Z.test(word)) {
    forms.push(`${word}zes`);
  }
  if (CONSONANT_Y.test(word)) {
    forms.push(`${word.slice(0, -1)}ies`);
  }
  return forms;
}

export const NOT_PLURALS: ReadonlySet<string> = new Set([
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

export const isPluralOf = (word: string, singular: string): boolean =>
  word !== singular &&
  !NOT_PLURALS.has(word) &&
  pluralsOf(singular).includes(word);
