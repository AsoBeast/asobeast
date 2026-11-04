import {
  truncateChars,
  type AlertReviewBody,
  type ReviewNegativePayload,
  type ReviewNewPayload,
  type ReviewSpikePayload,
  type ReviewSpikeTheme,
} from '@asobeast/shared';
import type { ReviewResult } from '../store-providers/types';
import type { Spike } from './review-spike';

export const REVIEW_ALERT_TEXT_MAX = 500;

export interface ReviewAlertApp {
  id: string;
  name: string | null;
}

export function alertReviewBody(review: ReviewResult): AlertReviewBody {
  return {
    score: review.score,
    title: review.title ?? null,
    text: truncateChars(review.text, REVIEW_ALERT_TEXT_MAX),
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

export function reviewNewPayload(
  app: ReviewAlertApp,
  review: ReviewResult,
  occurredAt: Date,
): ReviewNewPayload {
  return {
    event: 'review.new',
    occurredAt: occurredAt.toISOString(),
    app,
    review: { ...alertReviewBody(review), author: review.userName ?? null },
  };
}

const share = (part: number, whole: number): number =>
  whole === 0 ? 0 : Math.round((part / whole) * 100) / 100;

export function reviewSpikePayload(
  app: ReviewAlertApp,
  spike: Spike,
  context: { lowScoreMax: number; topTheme: ReviewSpikeTheme | null },
  occurredAt: Date,
): ReviewSpikePayload {
  return {
    event: 'review.spike',
    occurredAt: occurredAt.toISOString(),
    app,
    date: spike.day,
    count: spike.count,
    median: spike.median,
    threshold: spike.threshold,
    lowShare: share(spike.low, spike.count),
    lowScoreMax: context.lowScoreMax,
    topTheme: context.topTheme,
  };
}
