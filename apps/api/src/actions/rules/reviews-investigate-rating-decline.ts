import { ReviewsInvestigateRatingDeclineEvidence } from '@asobeast/shared';
import type {
  ActionContext,
  ActionContextApp,
  ActionReview,
} from '../action-context';
import { clampUnit } from '../action-impact';
import type { ActionDetector, DetectedAction } from '../action-rule';
import { detectReviewsInvestigateTheme } from './reviews-investigate-theme';

export const RATING_DECLINE_RECENT_DAYS = 14;
export const RATING_DECLINE_BASELINE_DAYS = 21;
export const RATING_DECLINE_MIN_REVIEWS = 5;
export const RATING_DECLINE_MIN_DROP = 0.5;
export const RATING_DECLINE_SEVERITY_DROP = 1.5;
export const RATING_DECLINE_CONFIDENCE_REVIEWS = 20;
export const RATING_DECLINE_MAX_SAMPLES = 5;

type DatedReview = ActionReview & { reviewedAt: Date };

const round2 = (value: number): number => Math.round(value * 100) / 100;

const average = (reviews: DatedReview[]): number =>
  round2(
    reviews.reduce((sum, review) => sum + review.score, 0) / reviews.length,
  );

function split(
  reviews: ActionReview[],
  now: Date,
): { recent: DatedReview[]; baseline: DatedReview[] } {
  const recentFrom = now.getTime() - RATING_DECLINE_RECENT_DAYS * 86_400_000;
  const baselineFrom = recentFrom - RATING_DECLINE_BASELINE_DAYS * 86_400_000;
  const dated = reviews.filter(
    (review): review is DatedReview => review.reviewedAt !== null,
  );
  return {
    recent: dated.filter((review) => review.reviewedAt.getTime() >= recentFrom),
    baseline: dated.filter(
      (review) =>
        review.reviewedAt.getTime() < recentFrom &&
        review.reviewedAt.getTime() >= baselineFrom,
    ),
  };
}

function detectForApp(
  app: ActionContextApp,
  reviewScoreMax: number,
  themed: ReadonlySet<string>,
  now: Date,
): DetectedAction | null {
  const { recent, baseline } = split(app.reviews, now);
  if (
    recent.length < RATING_DECLINE_MIN_REVIEWS ||
    baseline.length < RATING_DECLINE_MIN_REVIEWS
  ) {
    return null;
  }
  const recentAverage = average(recent);
  const baselineAverage = average(baseline);
  const drop = round2(baselineAverage - recentAverage);
  if (drop < RATING_DECLINE_MIN_DROP) return null;

  const negative = recent
    .filter((review) => review.score <= reviewScoreMax)
    .sort(
      (left, right) => right.reviewedAt.getTime() - left.reviewedAt.getTime(),
    );
  const evidence: ReviewsInvestigateRatingDeclineEvidence = {
    rule: 'reviews.investigate_rating_decline',
    recentAverage,
    baselineAverage,
    drop,
    recentReviews: recent.length,
    baselineReviews: baseline.length,
    recentDays: RATING_DECLINE_RECENT_DAYS,
    baselineDays: RATING_DECLINE_BASELINE_DAYS,
    latestVersion: app.latestVersion,
    negativeShare: round2(negative.length / recent.length),
    sampleReviewIds: negative
      .slice(0, RATING_DECLINE_MAX_SAMPLES)
      .map((review) => review.id),
  };
  return {
    rule: 'reviews.investigate_rating_decline',
    appId: app.id,
    store: app.store,
    country: app.country,
    keywordId: null,
    discriminator: null,
    terms: {
      reach: clampUnit(recent.length / RATING_DECLINE_CONFIDENCE_REVIEWS),
      severity: clampUnit(drop / RATING_DECLINE_SEVERITY_DROP),
      confidence: clampUnit(
        Math.min(recent.length, baseline.length) /
          RATING_DECLINE_CONFIDENCE_REVIEWS,
      ),
    },
    evidence,
    ...(themed.has(app.id) ? { withheld: true as const } : {}),
  };
}

export function detectReviewsInvestigateRatingDecline(
  context: ActionContext,
  now: Date,
): DetectedAction[] {
  const themed = new Set(
    detectReviewsInvestigateTheme(context, now).map(
      (detection) => detection.appId,
    ),
  );
  return context.apps
    .map((app) => detectForApp(app, context.reviewScoreMax, themed, now))
    .filter((detection): detection is DetectedAction => detection !== null);
}

export const reviewsInvestigateRatingDeclineDetector: ActionDetector = {
  rule: 'reviews.investigate_rating_decline',
  detect: detectReviewsInvestigateRatingDecline,
};
