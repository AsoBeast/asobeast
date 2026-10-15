import { QUERY_BOUNDS, ReviewTheme, tokenize } from '@asobeast/shared';
import { MinableReview, reviewPhrases } from '../keywords/review-mining';

export const REVIEW_THEMES_LIMIT = 8;
export const REVIEW_THEMES_MIN_REVIEWS = 2;
export const REVIEW_THEMES_CAP = QUERY_BOUNDS.reviewsLimit.max;

const GENERIC_WORDS = ['app', 'apps', 'application', 'game', 'games'];

export interface ThemeReview extends MinableReview {
  score: number;
}

export interface ThemeOptions {
  languages: readonly string[];
  negativeScoreMax: number;
  excluded: ReadonlySet<string>;
}

export function themeExclusions(appName: string | null): Set<string> {
  const name = tokenize(appName ?? '');
  return new Set([...GENERIC_WORDS, ...name, name.join(' ')]);
}

const rank = (a: ReviewTheme, b: ReviewTheme) =>
  b.negative - a.negative ||
  b.mentions - a.mentions ||
  a.phrase.localeCompare(b.phrase);

const countsOf = ({ negative, mentions }: ReviewTheme) =>
  `${negative}:${mentions}`;

function shorterPhrasesOf(phrase: string): string[] {
  const tokens = phrase.split(' ');
  const shorter: string[] = [];
  for (let size = 1; size < tokens.length; size += 1) {
    for (let start = 0; start + size <= tokens.length; start += 1) {
      shorter.push(tokens.slice(start, start + size).join(' '));
    }
  }
  return shorter;
}

function mentionsOf(
  reviews: readonly ThemeReview[],
  { languages, negativeScoreMax, excluded }: ThemeOptions,
): ReviewTheme[] {
  const themes = new Map<string, ReviewTheme>();
  for (const review of reviews) {
    const negative = review.score <= negativeScoreMax ? 1 : 0;
    for (const phrase of reviewPhrases(review, languages)) {
      if (excluded.has(phrase)) continue;
      const theme = themes.get(phrase) ?? { phrase, mentions: 0, negative: 0 };
      theme.mentions += 1;
      theme.negative += negative;
      themes.set(phrase, theme);
    }
  }
  return [...themes.values()];
}

function withoutShadowed(themes: ReviewTheme[]): ReviewTheme[] {
  const byPhrase = new Map(themes.map((theme) => [theme.phrase, theme]));
  const shadowed = new Set<string>();
  for (const theme of themes) {
    for (const phrase of shorterPhrasesOf(theme.phrase)) {
      const shorter = byPhrase.get(phrase);
      if (shorter && countsOf(shorter) === countsOf(theme)) {
        shadowed.add(phrase);
      }
    }
  }
  return themes.filter((theme) => !shadowed.has(theme.phrase));
}

export function reviewThemes(
  reviews: readonly ThemeReview[],
  options: ThemeOptions,
): ReviewTheme[] {
  const repeated = mentionsOf(reviews, options).filter(
    (theme) => theme.mentions >= REVIEW_THEMES_MIN_REVIEWS,
  );
  return withoutShadowed(repeated).sort(rank).slice(0, REVIEW_THEMES_LIMIT);
}
