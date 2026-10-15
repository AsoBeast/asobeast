import { ReviewTheme, tokenize } from '@asobeast/shared';
import { MinableReview, reviewPhrases } from '../keywords/review-mining';

export const REVIEW_THEMES_LIMIT = 8;
export const REVIEW_THEME_MIN_REVIEWS = 2;
export const REVIEW_THEMES_CAP = 500;

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

const contains = (outer: string, inner: string) =>
  outer !== inner && ` ${outer} `.includes(` ${inner} `);

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
  const peers = new Map<string, ReviewTheme[]>();
  for (const theme of themes) {
    peers.set(countsOf(theme), [...(peers.get(countsOf(theme)) ?? []), theme]);
  }
  return themes.filter(
    (theme) =>
      !(peers.get(countsOf(theme)) ?? []).some((peer) =>
        contains(peer.phrase, theme.phrase),
      ),
  );
}

export function reviewThemes(
  reviews: readonly ThemeReview[],
  options: ThemeOptions,
): ReviewTheme[] {
  const repeated = mentionsOf(reviews, options).filter(
    (theme) => theme.mentions >= REVIEW_THEME_MIN_REVIEWS,
  );
  return withoutShadowed(repeated).sort(rank).slice(0, REVIEW_THEMES_LIMIT);
}
