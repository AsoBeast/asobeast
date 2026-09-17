import { Store } from '@prisma/client';
import { AuditUnlock } from '@asobeast/shared';
import {
  mineReviewPhrases,
  REVIEW_THEME_MIN_MENTIONS,
} from '../../keywords/review-mining';
import { logScale } from '../../scoring/formulas';
import { round1 } from '../audit-engine';
import {
  AuditContext,
  AuditReview,
  check,
  DAY_MS,
  ratingAverageScore,
  RubricCheck,
} from '../audit-scoring';

export const MIN_BENCHMARK_COMPETITORS = 2;
export const RECENT_REVIEW_DAYS = 30;
export const MIN_RECENT_REVIEWS = 5;
export const MIN_CURRENT_VERSION_REVIEWS = 5;
export const GOOD_RATING_AVERAGE = 4.5;
export const FAIR_RATING_AVERAGE = 4;

export const RATING_VOLUME_BANDS = [
  { min: 1, score: 10 },
  { min: 0.5, score: 7 },
  { min: 0.2, score: 4 },
] as const;

export const RECENT_REVIEW_BANDS = [
  { min: 4.3, score: 10 },
  { min: 3.8, score: 7 },
  { min: 3, score: 4 },
] as const;

export const CURRENT_VERSION_BANDS = [
  { min: -0.1, score: 10 },
  { min: -0.3, score: 6 },
] as const;

export const REVIEWS_UNLOCK: AuditUnlock = {
  kind: 'reviews',
  label: `Needs ${MIN_RECENT_REVIEWS} reviews from the last ${RECENT_REVIEW_DAYS} days`,
};

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
};

const volumeScore = (ratio: number): number =>
  RATING_VOLUME_BANDS.find((band) => ratio >= band.min)?.score ?? 2;

const recentScore = (mean: number): number =>
  RECENT_REVIEW_BANDS.find((band) => mean >= band.min)?.score ?? 1;

const currentVersionScore = (delta: number): number =>
  CURRENT_VERSION_BANDS.find((band) => delta >= band.min)?.score ?? 2;

const recentReviews = (context: AuditContext): AuditReview[] => {
  const cutoff = context.now.getTime() - RECENT_REVIEW_DAYS * DAY_MS;
  return context.reviews.filter(
    (review) =>
      review.reviewedAt !== null && review.reviewedAt.getTime() >= cutoff,
  );
};

export const complaintTheme = (
  reviews: AuditReview[],
  reviewScoreMax: number,
): { text: string; mentions: number } | null => {
  const negative = reviews.filter((review) => review.score <= reviewScoreMax);
  const [top] = mineReviewPhrases(negative, new Set());
  const mentions = top?.usedByCount ?? 0;
  return top && mentions >= REVIEW_THEME_MIN_MENTIONS
    ? { text: top.text, mentions }
    : null;
};

const averageCheck = (context: AuditContext, theme: string): RubricCheck => {
  const average = context.ratingAvg;
  const threshold =
    average !== null && average >= FAIR_RATING_AVERAGE
      ? GOOD_RATING_AVERAGE
      : FAIR_RATING_AVERAGE;
  return check({
    id: 'ratings-average',
    label: 'Average rating',
    source: 'store',
    weight: 3,
    score: average === null ? null : ratingAverageScore(average),
    detail:
      average === null
        ? 'No ratings yet.'
        : `Average rating is ${average.toFixed(2)}.`,
    advice:
      average === null
        ? null
        : {
            title: `Raise your average rating above ${threshold}`,
            fix: `At ${average.toFixed(2)} stars you convert fewer visitors than an app above ${threshold}. Prompt happy users after a success moment${theme}.`,
          },
  });
};

const volumeCheck = (context: AuditContext): RubricCheck => {
  const count = context.ratingCount;
  const counts = context.competitors
    .map((entry) => entry.ratingCount)
    .filter((value): value is number => value !== null);
  const benchmarked = counts.length >= MIN_BENCHMARK_COMPETITORS;
  const middle = benchmarked ? median(counts) : null;
  return check({
    id: 'ratings-volume',
    label: 'Rating volume',
    source: benchmarked ? 'competitors' : 'store',
    weight: 2,
    score:
      count === null
        ? null
        : middle === null || middle === 0
          ? logScale(count, 10, 100_000)
          : volumeScore(count / middle),
    detail:
      count === null
        ? 'No ratings yet.'
        : middle === null
          ? `You have ${count} ratings. Add competitors to compare against your category.`
          : `You have ${count} ratings; the median competitor has ${middle}.`,
    advice:
      count === null
        ? null
        : {
            title: 'Grow your rating count',
            fix:
              middle === null
                ? `You have ${count} ratings. Add competitors to compare against your category.`
                : `You have ${count} ratings; the median competitor has ${middle}.`,
          },
  });
};

const recentCheck = (context: AuditContext): RubricCheck => {
  const reviews = recentReviews(context);
  const enough = reviews.length >= MIN_RECENT_REVIEWS;
  const mean = enough
    ? round1(
        reviews.reduce((sum, review) => sum + review.score, 0) / reviews.length,
      )
    : null;
  const theme = complaintTheme(reviews, context.reviewScoreMax);
  const themeSentence = theme
    ? ` “${theme.text}” comes up in ${theme.mentions} of them.`
    : '';
  return check({
    id: 'ratings-recent',
    label: 'Recent reviews',
    source: 'reviews',
    weight: 2,
    score: mean === null ? null : recentScore(mean),
    detail: enough
      ? `Reviews from the last ${RECENT_REVIEW_DAYS} days average ${mean} across ${reviews.length}.${themeSentence}`
      : `Only ${reviews.length} reviews in the last ${RECENT_REVIEW_DAYS} days.`,
    unlock: REVIEWS_UNLOCK,
    advice: {
      title: 'Address what recent reviewers report',
      fix: `Reviews from the last ${RECENT_REVIEW_DAYS} days average ${mean} across ${reviews.length}.${themeSentence}`,
    },
  });
};

const currentVersionCheck = (context: AuditContext): RubricCheck | null => {
  const { currentVersionScore: current, currentVersionReviews } =
    context.rawFacts;
  if (
    context.store !== Store.APP_STORE ||
    current === null ||
    context.ratingAvg === null ||
    (currentVersionReviews ?? 0) < MIN_CURRENT_VERSION_REVIEWS
  ) {
    return null;
  }
  const delta = round1(current - context.ratingAvg);
  return check({
    id: 'ratings-current-version',
    label: 'Current version rating',
    source: 'store',
    weight: 1,
    score: currentVersionScore(delta),
    detail: `This version averages ${current} against ${context.ratingAvg} overall.`,
    advice: {
      title: 'Find out why this version rates lower',
      fix: `This version averages ${current} against ${context.ratingAvg} overall.`,
    },
  });
};

export const ratingChecks = (context: AuditContext): RubricCheck[] => {
  const theme = complaintTheme(recentReviews(context), context.reviewScoreMax);
  const themeClause = theme ? ` and fix “${theme.text}”` : '';
  return [
    averageCheck(context, themeClause),
    volumeCheck(context),
    recentCheck(context),
    ...[currentVersionCheck(context)].filter(
      (item): item is RubricCheck => item !== null,
    ),
  ];
};
