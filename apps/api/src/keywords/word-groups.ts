import { countChars, tokenize } from '@asobeast/shared';
import { isExtractionStopword } from './extraction-stopwords';

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

interface Word {
  segment: string;
  index: number;
}

const wordsOf = (run: string): Word[] =>
  [...segmenter.segment(run)]
    .filter((part) => part.isWordLike)
    .map(({ segment, index }) => ({ segment, index }));

function trimNoise(words: Word[]): Word[] {
  const content = words.map((word) => !isExtractionStopword(word.segment));
  const first = content.indexOf(true);
  return first === -1 ? [] : words.slice(first, content.lastIndexOf(true) + 1);
}

const KATAKANA_CONTINUATION = /^[ァィゥェォッャュョヮヵヶンー]/u;

const attachesLeft = (word: string): boolean =>
  countChars(word) <= 2 || KATAKANA_CONTINUATION.test(word);

const opensRight = (word: string, startsRun: boolean): boolean =>
  word.endsWith('ッ') ||
  (countChars(word) === 2 && word.endsWith('ー')) ||
  (startsRun && countChars(word) === 1);

function joinKatakanaFragments(words: string[]): string[] {
  const joined: string[] = [];
  let open = false;
  for (const word of words) {
    const previous = joined.at(-1);
    const katakana = KATAKANA_ONLY.test(word);
    const continues =
      katakana && previous !== undefined && KATAKANA_ONLY.test(previous);
    if (continues && (open || attachesLeft(word))) {
      joined[joined.length - 1] = previous + word;
    } else {
      joined.push(word);
    }
    open = katakana && opensRight(word, !continues);
  }
  return joined;
}

const HAN_PARTICLES: ReadonlySet<string> = new Set([
  '的',
  '了',
  '是',
  '在',
  '和',
  '与',
  '與',
  '及',
  '或',
  '让',
  '讓',
  '你',
  '我',
  '他',
  '她',
  '都',
  '也',
  '就',
  '很',
  '把',
  '被',
  '给',
  '給',
  '从',
  '從',
  '对',
  '對',
  '为',
  '為',
]);
const SINGLE_HAN = /^\p{Script=Han}$/u;

export const isBoundWord = (word: string): boolean => SINGLE_HAN.test(word);

const isGrammar = (word: string): boolean =>
  HIRAGANA_ONLY.test(word) || HAN_PARTICLES.has(word);

function splitAtGrammar(words: string[]): string[][] {
  const groups: string[][] = [[]];
  for (const word of words) {
    if (isGrammar(word)) {
      groups.push([]);
    } else {
      groups[groups.length - 1].push(word);
    }
  }
  return groups.filter((group) => group.length > 0);
}

function mergeBoundWords(words: string[]): string[] {
  const merged: string[] = [];
  for (const word of words) {
    const previous = merged.at(-1);
    if (previous !== undefined && isBoundWord(previous) && isBoundWord(word)) {
      merged[merged.length - 1] = previous + word;
    } else {
      merged.push(word);
    }
  }
  return merged;
}

function spacelessGroups(run: string): WordGroup[] {
  const words = trimNoise(wordsOf(run));
  if (words.length === 0) {
    return [];
  }
  const last = words[words.length - 1];
  const core = run.slice(words[0].index, last.index + last.segment.length);
  const keepWhole =
    countChars(core) <= SPACELESS_UNIT_MAX_CHARS &&
    (countChars(run) <= SPACELESS_UNIT_MAX_CHARS || HIRAGANA_ONLY.test(core));
  const tokenGroups = keepWhole
    ? [[core]]
    : splitAtGrammar(
        joinKatakanaFragments(words.map((word) => word.segment)),
      ).map(mergeBoundWords);
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
