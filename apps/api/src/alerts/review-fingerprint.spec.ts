import type { ReviewNegativePayload } from '@asobeast/shared';
import { negative, newReview } from './email-fixtures.fixture';
import { reviewFingerprint, reviewKey } from './review-fingerprint';

const asNew = (payload: ReviewNegativePayload) => ({
  ...newReview,
  app: payload.app,
  review: { ...payload.review, author: 'Alex' },
});

describe('reviewFingerprint', () => {
  it('keeps the fingerprint the outbox already stores', () => {
    expect(reviewFingerprint(negative)).toBe('1vitjht');
  });

  it('fingerprints both review events of one review alike', () => {
    expect(reviewFingerprint(asNew(negative))).toBe(
      reviewFingerprint(negative),
    );
  });

  it.each([
    ['text', { text: 'Freezes on launch' }],
    ['title', { title: 'Worse' }],
    ['reviewed time', { reviewedAt: '2026-07-11T00:00:00.000Z' }],
  ])('changes with the %s', (_field, change) => {
    expect(
      reviewFingerprint({
        ...negative,
        review: { ...negative.review, ...change },
      }),
    ).not.toBe(reviewFingerprint(negative));
  });
});

describe('reviewKey', () => {
  it('tells the same review of two apps apart', () => {
    expect(
      reviewKey({ ...negative, app: { id: 'app_2', name: 'Other' } }),
    ).not.toBe(reviewKey(negative));
    expect(reviewKey(negative)).toBe('app_1:1vitjht');
  });
});
