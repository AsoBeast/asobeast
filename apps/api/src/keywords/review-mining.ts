import { KeywordSuggestion, tokenize } from '@asobeast/shared';
import { usableIn } from './extraction';
import { functionWordTest } from './function-words';
import type { TokenTest } from './function-words';
import { listingSegments } from './listing-segments';

export interface MinableReview {
  title: string | null;
  text: string;
}

export const REVIEW_THEME_MIN_MENTIONS = 3;

const MAX_NGRAM = 3;
const MIN_PHRASE_LENGTH = 3;
const REVIEW_FILLERS: ReadonlySet<string> = new Set([
  'just',
  'really',
  'actually',
  'even',
  'still',
  'please',
]);

function* ngramsOf(tokens: string[], isUsable: TokenTest): Generator<string> {
  for (let n = 1; n <= MAX_NGRAM; n += 1) {
    for (let i = 0; i + n <= tokens.length; i += 1) {
      if (!isUsable(tokens[i]) || !isUsable(tokens[i + n - 1])) continue;
      const text = tokens.slice(i, i + n).join(' ');
      if (text.length >= MIN_PHRASE_LENGTH) yield text;
    }
  }
}

function phrasesOf(review: MinableReview, isUsable: TokenTest): Set<string> {
  const phrases = new Set<string>();
  for (const field of [review.title ?? '', review.text]) {
    for (const segment of listingSegments(field)) {
      for (const text of ngramsOf(tokenize(segment), isUsable)) {
        phrases.add(text);
      }
    }
  }
  return phrases;
}

function usableFor(languages: readonly string[]): TokenTest {
  const usable = usableIn(functionWordTest(languages));
  return (token) => usable(token) && !REVIEW_FILLERS.has(token);
}

export function reviewPhrases(
  review: MinableReview,
  languages: readonly string[],
): Set<string> {
  return phrasesOf(review, usableFor(languages));
}

export function mineReviewPhrases(
  reviews: MinableReview[],
  tracked: Set<string>,
  languages: readonly string[],
): KeywordSuggestion[] {
  const isUsable = usableFor(languages);
  const counts = new Map<string, number>();
  for (const review of reviews) {
    for (const phrase of phrasesOf(review, isUsable)) {
      if (tracked.has(phrase)) {
        continue;
      }
      counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort(([textA, a], [textB, b]) => b - a || textA.localeCompare(textB))
    .map(([text, usedByCount]) => ({
      text,
      strategy: 'reviews' as const,
      usedByCount,
    }));
}
