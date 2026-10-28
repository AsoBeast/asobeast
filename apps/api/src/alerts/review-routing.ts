import { listsReviewScore, type AlertPayload } from '@asobeast/shared';

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
