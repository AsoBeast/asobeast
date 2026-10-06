import { countChars, tokenize } from '@asobeast/shared';
import {
  KANA_CHARACTER,
  SPACELESS_CHARACTER,
  SPACELESS_OR_NOT,
  THAI_CHARACTER,
} from '../common/text/scripts';
import {
  isChineseParticle,
  isExtractionStopword,
  isStoreNoise,
} from './extraction-stopwords';
import { attachThaiPrefixes, thaiSpans } from './thai-words';

export interface WordGroup {
  tokens: string[];
  joiner: ' ' | '';
  startsChunk: boolean;
}

const SPACELESS_UNIT_MAX_CHARS = 5;

const HIRAGANA_ONLY = /^\p{scx=Hiragana}+$/u;
const KATAKANA_ONLY = /^\p{scx=Katakana}+$/u;

const segmenter = new Intl.Segmenter('en', { granularity: 'word' });

interface Word {
  segment: string;
  index: number;
}

const segmentedWords = (text: string, offset: number): Word[] =>
  [...segmenter.segment(text)]
    .filter((part) => part.isWordLike)
    .map(({ segment, index }) => ({ segment, index: offset + index }));

const thaiWordsOf = (run: string): Word[] =>
  thaiSpans(run).flatMap((span) =>
    span.known
      ? [{ segment: span.text, index: span.index }]
      : segmentedWords(span.text, span.index),
  );

const wordsOf = (run: string): Word[] =>
  THAI_CHARACTER.test(run) ? thaiWordsOf(run) : segmentedWords(run, 0);

function trimNoise(words: Word[]): Word[] {
  const content = words.map((word) => !isStoreNoise(word.segment));
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

const SINGLE_HAN = /^\p{Script=Han}$/u;

export const isBoundWord = (word: string): boolean => SINGLE_HAN.test(word);

type WordTest = (word: string) => boolean;

const japaneseGrammar: WordTest = (word) => HIRAGANA_ONLY.test(word);
const chineseGrammar: WordTest = (word) =>
  HIRAGANA_ONLY.test(word) || isChineseParticle(word);

function splitAtGrammar(words: string[], isGrammar: WordTest): string[][] {
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

const isShortTitle = (
  core: string,
  words: Word[],
  isGrammar: WordTest,
): boolean =>
  countChars(core) <= SPACELESS_UNIT_MAX_CHARS &&
  !words.some((word) => isGrammar(word.segment)) &&
  words.some((word) => isExtractionStopword(word.segment));

function spacelessGroups(
  run: string,
  startsChunk: boolean,
  isGrammar: WordTest,
): WordGroup[] {
  const runWords = wordsOf(run);
  const words = trimNoise(runWords);
  if (words.length === 0) {
    return [];
  }
  const last = words[words.length - 1];
  const core = run.slice(words[0].index, last.index + last.segment.length);
  if (
    countChars(core) <= SPACELESS_UNIT_MAX_CHARS &&
    HIRAGANA_ONLY.test(core)
  ) {
    return [{ tokens: [core], joiner: '', startsChunk }];
  }
  const leads =
    startsChunk && words[0] === runWords[0] && !isGrammar(words[0].segment);
  const groups = splitAtGrammar(
    attachThaiPrefixes(
      joinKatakanaFragments(words.map((word) => word.segment)),
    ),
    isGrammar,
  )
    .map(mergeBoundWords)
    .map((tokens, index): WordGroup => ({
      tokens,
      joiner: '',
      startsChunk: leads && index === 0,
    }));
  return startsChunk && isShortTitle(core, words, isGrammar)
    ? [...groups, { tokens: [core], joiner: '', startsChunk: false }]
    : groups;
}

export function wordGroups(segment: string): WordGroup[] {
  const groups: WordGroup[] = [];
  let spaced: string[] = [];
  const flushSpaced = () => {
    if (spaced.length > 0) {
      groups.push({ tokens: spaced, joiner: ' ', startsChunk: false });
      spaced = [];
    }
  };
  const isGrammar = KANA_CHARACTER.test(segment)
    ? japaneseGrammar
    : chineseGrammar;
  for (const chunk of tokenize(segment)) {
    for (const { 0: run, index } of chunk.matchAll(SPACELESS_OR_NOT)) {
      if (SPACELESS_CHARACTER.test(run)) {
        flushSpaced();
        groups.push(...spacelessGroups(run, index === 0, isGrammar));
      } else {
        spaced.push(run);
      }
    }
  }
  flushSpaced();
  return groups;
}
