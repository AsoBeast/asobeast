import { countChars, tokenize } from '@asobeast/shared';

export interface WordGroup {
  tokens: string[];
  joiner: ' ' | '';
}

const SPACELESS_UNIT_MAX_CHARS = 5;

const SPACELESS_SCRIPTS = String.raw`\p{Script=Han}\p{scx=Hiragana}\p{scx=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}`;
const SPACELESS_CHAR = new RegExp(`[${SPACELESS_SCRIPTS}]`, 'u');
const SPACELESS_OR_NOT = new RegExp(
  `[${SPACELESS_SCRIPTS}]+|[^${SPACELESS_SCRIPTS}]+`,
  'gu',
);
const HIRAGANA_ONLY = /^\p{scx=Hiragana}+$/u;
const KATAKANA_ONLY = /^\p{scx=Katakana}+$/u;

const segmenter = new Intl.Segmenter('en', { granularity: 'word' });

const wordsOf = (run: string): string[] =>
  [...segmenter.segment(run)]
    .filter((part) => part.isWordLike)
    .map((part) => part.segment);

const isKatakanaFragment = (previous: string, word: string): boolean =>
  KATAKANA_ONLY.test(previous) &&
  KATAKANA_ONLY.test(word) &&
  (countChars(previous) === 1 || countChars(word) === 1);

function joinKatakanaFragments(words: string[]): string[] {
  const joined: string[] = [];
  for (const word of words) {
    const previous = joined.at(-1);
    if (previous !== undefined && isKatakanaFragment(previous, word)) {
      joined[joined.length - 1] = previous + word;
    } else {
      joined.push(word);
    }
  }
  return joined;
}

function splitAtHiragana(words: string[]): string[][] {
  const groups: string[][] = [[]];
  for (const word of words) {
    if (HIRAGANA_ONLY.test(word)) {
      groups.push([]);
    } else {
      groups[groups.length - 1].push(word);
    }
  }
  return groups.filter((group) => group.length > 0);
}

function spacelessGroups(run: string): WordGroup[] {
  const tokenGroups =
    countChars(run) <= SPACELESS_UNIT_MAX_CHARS
      ? [[run]]
      : splitAtHiragana(joinKatakanaFragments(wordsOf(run)));
  return tokenGroups.map((tokens) => ({ tokens, joiner: '' }));
}

export function wordGroups(segment: string): WordGroup[] {
  const groups: WordGroup[] = [];
  let spaced: string[] = [];
  const flushSpaced = () => {
    if (spaced.length > 0) {
      groups.push({ tokens: spaced, joiner: ' ' });
      spaced = [];
    }
  };
  for (const chunk of tokenize(segment)) {
    for (const run of chunk.match(SPACELESS_OR_NOT) ?? []) {
      if (SPACELESS_CHAR.test(run)) {
        flushSpaced();
        groups.push(...spacelessGroups(run));
      } else {
        spaced.push(run);
      }
    }
  }
  flushSpaced();
  return groups;
}
