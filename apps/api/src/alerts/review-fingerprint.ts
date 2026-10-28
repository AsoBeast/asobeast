import type { ReviewNegativePayload, ReviewNewPayload } from '@asobeast/shared';

export type ReviewAlertPayload = ReviewNegativePayload | ReviewNewPayload;

function hash(input: string): string {
  let value = 5381;
  for (let i = 0; i < input.length; i += 1) {
    value = (value * 33) ^ input.charCodeAt(i);
  }
  return (value >>> 0).toString(36);
}

export function reviewFingerprint(payload: ReviewAlertPayload): string {
  return hash(
    `${payload.review.reviewedAt ?? ''}|${payload.review.title ?? ''}|${payload.review.text}`,
  );
}

export function reviewKey(payload: ReviewAlertPayload): string {
  return `${payload.app.id}:${reviewFingerprint(payload)}`;
}
