import { isStopword, KeywordSuggestion, tokenize } from '@asobeast/shared';

export interface MinableReview {
  title: string | null;
  text: string;
}

const MAX_NGRAM = 3;
const MIN_PHRASE_LENGTH = 3;

function phrasesOf(review: MinableReview): Set<string> {
  const tokens = tokenize(`${review.title ?? ''} ${review.text}`);
  const phrases = new Set<string>();
  for (let n = 1; n <= MAX_NGRAM; n += 1) {
    for (let i = 0; i + n <= tokens.length; i += 1) {
      const slice = tokens.slice(i, i + n);
      const text = slice.join(' ');
      if (text.length < MIN_PHRASE_LENGTH) {
        continue;
      }
      if (slice.every((token) => isStopword(token))) {
        continue;
      }
      phrases.add(text);
    }
  }
  return phrases;
}

export function mineReviewPhrases(
  reviews: MinableReview[],
  tracked: Set<string>,
): KeywordSuggestion[] {
  const counts = new Map<string, number>();
  for (const review of reviews) {
    for (const phrase of phrasesOf(review)) {
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
