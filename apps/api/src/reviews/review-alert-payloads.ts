import type { AlertReviewBody, ReviewNegativePayload } from '@asobeast/shared';
import type { ReviewResult } from '../store-providers/types';

export const REVIEW_ALERT_TEXT_MAX = 500;

export interface ReviewAlertApp {
  id: string;
  name: string | null;
}

export function alertReviewBody(review: ReviewResult): AlertReviewBody {
  return {
    score: review.score,
    title: review.title ?? null,
    text: review.text.slice(0, REVIEW_ALERT_TEXT_MAX),
    version: review.version ?? null,
    reviewedAt: review.updatedAt ? review.updatedAt.toISOString() : null,
  };
}

export function reviewNegativePayload(
  app: ReviewAlertApp,
  review: ReviewResult,
  occurredAt: Date,
): ReviewNegativePayload {
  return {
    event: 'review.negative',
    occurredAt: occurredAt.toISOString(),
    app,
    review: alertReviewBody(review),
  };
}
