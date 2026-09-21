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

export const sameWord = (a: string, b: string): boolean =>
  pluralsOf(a).includes(b) || pluralsOf(b).includes(a);
