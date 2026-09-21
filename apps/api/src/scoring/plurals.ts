const ES_STEM = /(s|x|z|ch|sh|o)$/;

export const pluralsOf = (word: string): string[] =>
  ES_STEM.test(word) ? [word, `${word}s`, `${word}es`] : [word, `${word}s`];

export const sameWord = (a: string, b: string): boolean =>
  pluralsOf(a).includes(b) || pluralsOf(b).includes(a);
