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

// In a script where every word inflects, no list can name the forms of a
// word, so two words count as the same word when they share a beginning at
// least this long. Real case forms of one word clear it («тревожности» and
// «тревожностью» share ten characters), while «тревога» and «тревожность»
// share six and stay different words, the way the store's own search keeps
// them apart.
export const INFLECTION_STEM_CHARS = 7;

function commonStemLength(a: string, b: string): number {
  let shared = 0;
  while (shared < a.length && shared < b.length && a[shared] === b[shared]) {
    shared += 1;
  }
  return shared;
}

export const sameStem = (a: string, b: string): boolean =>
  hasInflectedStemScript(a) &&
  hasInflectedStemScript(b) &&
  commonStemLength(a, b) >= INFLECTION_STEM_CHARS;

export const sameWord = (a: string, b: string): boolean =>
  pluralsOf(a).includes(b) || pluralsOf(b).includes(a) || sameStem(a, b);
