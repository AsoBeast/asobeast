import { hasInflectedStemScript } from '../common/text/scripts';

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

export const INFLECTION_STEM_CHARS = 7;

const commonStemOf = (a: string, b: string): string => {
  const shared: string[] = [];
  for (
    let index = 0;
    index < a.length && index < b.length && a[index] === b[index];
    index += 1
  ) {
    shared.push(a[index]);
  }
  return shared.join('');
};

export const sameStem = (a: string, b: string): boolean => {
  const stem = commonStemOf(a, b);
  return (
    stem.length >= INFLECTION_STEM_CHARS &&
    Array.from(stem).every((character) => hasInflectedStemScript(character))
  );
};

export const sameWord = (a: string, b: string): boolean =>
  pluralsOf(a).includes(b) || pluralsOf(b).includes(a) || sameStem(a, b);
