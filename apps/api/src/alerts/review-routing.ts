import {
  listsReviewScore,
  type AlertPayload,
  type GranularAlertPayload,
} from '@asobeast/shared';
import { reviewKey } from './review-fingerprint';

export interface Subscription {
  events: readonly string[];
  reviewScores: readonly number[];
}

export function listsNewReview(
  subscription: Subscription,
  score: number,
): boolean {
  return (
    subscription.events.includes('review.new') &&
    listsReviewScore(subscription.reviewScores, score)
  );
}

export function receivesInstant(
  subscription: Subscription,
  payload: AlertPayload,
): boolean {
  if (!subscription.events.includes(payload.event)) return false;
  if (payload.event === 'review.new') {
    return listsReviewScore(subscription.reviewScores, payload.review.score);
  }
  if (payload.event === 'review.negative') {
    return !listsNewReview(subscription, payload.review.score);
  }
  return true;
}

export function reviewGate(
  events: readonly GranularAlertPayload[],
  allowed: ReadonlySet<string>,
  reviewScores: readonly number[],
): (payload: GranularAlertPayload) => boolean {
  const listed = new Set(
    events.flatMap((event) =>
      event.event === 'review.new' &&
      allowed.has('review.new') &&
      listsReviewScore(reviewScores, event.review.score)
        ? [reviewKey(event)]
        : [],
    ),
  );
  return (payload) => {
    if (!allowed.has(payload.event)) return false;
    if (payload.event === 'review.new') {
      return listsReviewScore(reviewScores, payload.review.score);
    }
    if (payload.event === 'review.negative') {
      return !listed.has(reviewKey(payload));
    }
    return true;
  };
}
