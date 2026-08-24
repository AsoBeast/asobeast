import { ReviewsInvestigateThemeEvidence } from '@asobeast/shared';
import { mineReviewPhrases } from '../../keywords/review-mining';
import type {
  ActionContext,
  ActionContextApp,
  ActionReview,
} from '../action-context';
import type { ActionDetector, DetectedAction } from '../action-rule';

export const REVIEW_THEME_MIN_MENTIONS = 3;
export const REVIEW_THEME_GROWTH_FACTOR = 2;
export const REVIEW_THEME_MIN_VERSION_REVIEWS = 5;
export const REVIEW_THEME_MAX_SAMPLES = 5;
export const REVIEW_THEME_WINDOW_DAYS = 30;
export const REVIEW_THEME_MAX_PER_APP = 3;
export const REVIEW_THEME_SEVERITY_CAP = REVIEW_THEME_MIN_MENTIONS * 3;
export const REVIEW_THEME_RATING_DROP_SCALE = 0.5;
export const REVIEW_THEME_RATING_WEIGHT = 0.3;
export const REVIEW_THEME_CONFIDENCE_REVIEWS = 20;

const NO_VERSION = '';

function withinWindow(reviews: ActionReview[], now: Date): ActionReview[] {
  const cutoff = now.getTime() - REVIEW_THEME_WINDOW_DAYS * 86_400_000;
  return reviews.filter(
    (review) =>
      review.reviewedAt === null || review.reviewedAt.getTime() >= cutoff,
  );
}

function mentionsByPhrase(reviews: ActionReview[]): Map<string, number> {
  const mined = mineReviewPhrases(
    reviews.map((review) => ({ title: review.title, text: review.text })),
    new Set(),
  );
  return new Map(
    mined.map((suggestion) => [suggestion.text, suggestion.usedByCount ?? 0]),
  );
}

function averageScore(reviews: ActionReview[]): number | null {
  if (reviews.length === 0) return null;
  return (
    reviews.reduce((sum, review) => sum + review.score, 0) / reviews.length
  );
}

function scoreDelta(
  current: ActionReview[],
  previous: ActionReview[],
): number | null {
  const latest = averageScore(current);
  const before = averageScore(previous);
  return latest === null || before === null
    ? null
    : Math.round((latest - before) * 100) / 100;
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function detectForApp(
  app: ActionContextApp,
  reviewScoreMax: number,
  now: Date,
): DetectedAction[] {
  const version = app.latestVersion;
  const previousVersion = app.previousVersion;
  if (version === null || previousVersion === null) return [];

  const windowed = withinWindow(app.reviews, now);
  const forVersion = windowed.filter(
    (review) => (review.version ?? NO_VERSION) === version,
  );
  if (forVersion.length < REVIEW_THEME_MIN_VERSION_REVIEWS) return [];

  const negative = forVersion.filter(
    (review) => review.score <= reviewScoreMax,
  );
  const previousNegative = windowed.filter(
    (review) =>
      (review.version ?? NO_VERSION) === previousVersion &&
      review.score <= reviewScoreMax,
  );
  if (negative.length === 0 || previousNegative.length === 0) return [];

  const current = mentionsByPhrase(negative);
  const previous = mentionsByPhrase(previousNegative);

  const ratingAvgDelta = scoreDelta(
    forVersion,
    windowed.filter(
      (review) => (review.version ?? NO_VERSION) === previousVersion,
    ),
  );

  return [...current.entries()]
    .filter(([theme, mentions]) => {
      if (mentions < REVIEW_THEME_MIN_MENTIONS) return false;
      const before = previous.get(theme) ?? 0;
      return mentions >= REVIEW_THEME_GROWTH_FACTOR * before;
    })
    .sort(
      ([leftTheme, left], [rightTheme, right]) =>
        right - left || leftTheme.localeCompare(rightTheme),
    )
    .slice(0, REVIEW_THEME_MAX_PER_APP)
    .map(([theme, mentions]): DetectedAction => {
      const evidence: ReviewsInvestigateThemeEvidence = {
        rule: 'reviews.investigate_theme',
        theme,
        version,
        previousVersion,
        mentions,
        previousMentions: previous.get(theme) ?? 0,
        negativeReviews: negative.length,
        totalReviews: forVersion.length,
        ratingAvgDelta,
        sampleReviewIds: negative
          .filter((review) =>
            `${review.title ?? ''} ${review.text}`
              .toLowerCase()
              .includes(theme),
          )
          .slice(0, REVIEW_THEME_MAX_SAMPLES)
          .map((review) => review.id),
      };

      const ratingDropTerm = clamp(
        -(ratingAvgDelta ?? 0) / REVIEW_THEME_RATING_DROP_SCALE,
      );

      return {
        rule: 'reviews.investigate_theme',
        appId: app.id,
        store: app.store,
        country: app.country,
        keywordId: null,
        discriminator: `${theme}~${version}`,
        terms: {
          reach: mentions / Math.max(negative.length, 1),
          severity:
            clamp(mentions / REVIEW_THEME_SEVERITY_CAP) *
              (1 - REVIEW_THEME_RATING_WEIGHT) +
            ratingDropTerm * REVIEW_THEME_RATING_WEIGHT,
          confidence: clamp(
            forVersion.length / REVIEW_THEME_CONFIDENCE_REVIEWS,
          ),
        },
        evidence,
      };
    });
}

export function detectReviewsInvestigateTheme(
  context: ActionContext,
  now: Date,
): DetectedAction[] {
  return context.apps.flatMap((app) =>
    detectForApp(app, context.reviewScoreMax, now),
  );
}

export const reviewsInvestigateThemeDetector: ActionDetector = {
  rule: 'reviews.investigate_theme',
  detect: detectReviewsInvestigateTheme,
};
