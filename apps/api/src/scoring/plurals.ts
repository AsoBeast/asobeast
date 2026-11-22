import { pluralsOf } from '@asobeast/shared';
import { hasInflectedStemScript } from '../common/text/scripts';

export { pluralsOf } from '@asobeast/shared';

export const INFLECTION_STEM_CHARS = 7;
export const INFLECTION_ENDING_CHARS = 3;

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
    a.length - stem.length <= INFLECTION_ENDING_CHARS &&
    b.length - stem.length <= INFLECTION_ENDING_CHARS &&
    Array.from(stem).every((character) => hasInflectedStemScript(character))
  );
};

export const sameWord = (a: string, b: string): boolean =>
  pluralsOf(a).includes(b) || pluralsOf(b).includes(a) || sameStem(a, b);
