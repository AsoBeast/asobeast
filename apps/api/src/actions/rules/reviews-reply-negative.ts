import { ReviewsReplyNegativeEvidence } from '@asobeast/shared';
import { NEGATIVE_REVIEW_MAX_SCORE } from '../../audit/checks/reputation-checks';
import type {
  ActionContext,
  ActionContextApp,
  ActionReview,
} from '../action-context';
import { clampUnit } from '../action-impact';
import type { ActionDetector, DetectedAction } from '../action-rule';

export const REPLY_WINDOW_DAYS = 14;
export const REPLY_MAX_SCORE = NEGATIVE_REVIEW_MAX_SCORE;
export const REPLY_MIN_UNANSWERED = 3;
export const REPLY_REACH_UNANSWERED = 10;
export const REPLY_MAX_SAMPLES = 5;
export const REPLY_SEVERE_SCORE = 2;

type DatedReview = ActionReview & { reviewedAt: Date };

const round2 = (value: number): number => Math.round(value * 100) / 100;

function detectForApp(app: ActionContextApp, now: Date): DetectedAction | null {
  if (app.store !== 'GOOGLE_PLAY') return null;
  const from = now.getTime() - REPLY_WINDOW_DAYS * 86_400_000;
  const negative = app.reviews.filter(
    (review): review is DatedReview =>
      review.reviewedAt !== null &&
      review.reviewedAt.getTime() >= from &&
      review.score <= REPLY_MAX_SCORE,
  );
  const checked = negative.filter((review) => review.replyCheckedAt !== null);
  const unanswered = checked
    .filter((review) => review.repliedAt === null)
    .sort(
      (left, right) =>
        left.score - right.score ||
        left.reviewedAt.getTime() - right.reviewedAt.getTime(),
    );
  if (unanswered.length < REPLY_MIN_UNANSWERED) return null;

  const oldest = Math.min(
    ...unanswered.map((review) => review.reviewedAt.getTime()),
  );
  const severe = unanswered.filter(
    (review) => review.score <= REPLY_SEVERE_SCORE,
  ).length;
  const evidence: ReviewsReplyNegativeEvidence = {
    rule: 'reviews.reply_negative',
    unanswered: unanswered.length,
    checked: checked.length,
    negative: negative.length,
    windowDays: REPLY_WINDOW_DAYS,
    oldestUnansweredAt: new Date(oldest).toISOString(),
    replyRate: round2((checked.length - unanswered.length) / checked.length),
    sampleReviewIds: unanswered
      .slice(0, REPLY_MAX_SAMPLES)
      .map((review) => review.id),
  };
  return {
    rule: 'reviews.reply_negative',
    appId: app.id,
    store: app.store,
    country: app.country,
    keywordId: null,
    discriminator: null,
    terms: {
      reach: clampUnit(unanswered.length / REPLY_REACH_UNANSWERED),
      severity: 0.5 + 0.5 * (severe / unanswered.length),
      confidence: checked.length / Math.max(negative.length, 1),
    },
    evidence,
  };
}

export function detectReviewsReplyNegative(
  context: ActionContext,
  now: Date,
): DetectedAction[] {
  return context.apps
    .map((app) => detectForApp(app, now))
    .filter((detection): detection is DetectedAction => detection !== null);
}

export const reviewsReplyNegativeDetector: ActionDetector = {
  rule: 'reviews.reply_negative',
  detect: detectReviewsReplyNegative,
};
