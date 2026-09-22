import { searchKey } from '@asobeast/shared';
import { clamp } from './curves';
import { sameWord } from './plurals';

export const EVIDENCE_EXACT = 1;
export const EVIDENCE_ALL_WORDS = 0.7;
export const EVIDENCE_PARTIAL = 0.4;
export const PADDING_SLOPE = 2.5;
export const PADDING_FLOOR = 0.25;
export const MATCH_ALL_WORDS = 0.85;
export const MATCH_PARTIAL_MAX = 0.5;

const UNSEGMENTED =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}]/u;

const containsWord = (
  haystack: string,
  tokens: string[],
  word: string,
): boolean =>
  UNSEGMENTED.test(word)
    ? haystack.includes(word)
    : tokens.some((token) => sameWord(token, word));

function containsPhrase(
  haystack: string,
  tokens: string[],
  phrase: string,
  words: string[],
): boolean {
  if (UNSEGMENTED.test(phrase)) {
    return haystack.includes(phrase);
  }
  return tokens.some((_, start) =>
    words.every((word, offset) => {
      const token = tokens[start + offset];
      return token !== undefined && sameWord(token, word);
    }),
  );
}

export interface TitledApp {
  title: string;
}

export function titleEvidence(title: string, keyword: string): number {
  const phrase = searchKey(keyword);
  if (phrase.length === 0) {
    return 0;
  }
  const haystack = searchKey(title);
  const tokens = haystack.split(' ');
  const words = phrase.split(' ');
  if (containsPhrase(haystack, tokens, phrase, words)) {
    return EVIDENCE_EXACT;
  }
  const present = words.filter((word) =>
    containsWord(haystack, tokens, word),
  ).length;
  return present === words.length
    ? EVIDENCE_ALL_WORDS
    : (present / words.length) * EVIDENCE_PARTIAL;
}

export interface TitleMatch {
  strong: boolean;
  evidence: number;
}

const runsTogether = (tokens: string[], words: string[]): boolean =>
  words.length > 1 && tokens.some((token) => token.startsWith(words.join('')));

function proximity(tokens: string[], words: string[]): number {
  const unique = [...new Set(words)];
  if (unique.length < 2) {
    return 0;
  }
  const positions = unique
    .map((word) => tokens.findIndex((token) => sameWord(token, word)))
    .filter((position) => position >= 0);
  if (positions.length < unique.length) {
    return 0;
  }
  const span = Math.max(...positions) - Math.min(...positions) + 1;
  return Math.min(1, unique.length / span);
}

export function titleMatch(title: string, keyword: string): TitleMatch {
  const phrase = searchKey(keyword);
  const haystack = searchKey(title);
  if (phrase.length === 0 || haystack.length === 0) {
    return { strong: false, evidence: 0 };
  }
  const tokens = haystack.split(' ');
  const words = phrase.split(' ');
  if (
    containsPhrase(haystack, tokens, phrase, words) ||
    runsTogether(tokens, words)
  ) {
    return { strong: true, evidence: EVIDENCE_EXACT };
  }
  const present = words.filter((word) =>
    containsWord(haystack, tokens, word),
  ).length;
  if (present === words.length) {
    return {
      strong: true,
      evidence:
        MATCH_ALL_WORDS + (1 - MATCH_ALL_WORDS) * proximity(tokens, words),
    };
  }
  return {
    strong: false,
    evidence: Math.min(
      MATCH_PARTIAL_MAX,
      (present / words.length) * MATCH_PARTIAL_MAX,
    ),
  };
}

export function serpRelevance(topTen: TitledApp[], keyword: string): number {
  if (topTen.length === 0) {
    return 0;
  }
  const total = topTen.reduce(
    (sum, item) => sum + titleEvidence(item.title, keyword),
    0,
  );
  return total / topTen.length;
}

export const paddingFactor = (topTen: TitledApp[], keyword: string): number =>
  clamp(serpRelevance(topTen, keyword) * PADDING_SLOPE, PADDING_FLOOR, 1);
