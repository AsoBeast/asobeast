import type { ReviewResult } from '../store-providers/types';
import {
  alertReviewBody,
  REVIEW_ALERT_TEXT_MAX,
  reviewNegativePayload,
} from './review-alert-payloads';

const review: ReviewResult = {
  reviewId: 'r1',
  userName: 'Alex',
  score: 2,
  title: 'Meh',
  text: 'Crashes on launch',
  version: '3.1.0',
  updatedAt: new Date('2026-10-28T01:40:00.000Z'),
};

describe('alertReviewBody', () => {
  it('maps every field of a full review', () => {
    expect(alertReviewBody(review)).toEqual({
      score: 2,
      title: 'Meh',
      text: 'Crashes on launch',
      version: '3.1.0',
      reviewedAt: '2026-10-28T01:40:00.000Z',
    });
  });

  it('maps a missing title, version and date to null', () => {
    expect(alertReviewBody({ reviewId: 'r2', score: 4, text: 'Nice' })).toEqual(
      {
        score: 4,
        title: null,
        text: 'Nice',
        version: null,
        reviewedAt: null,
      },
    );
  });

  it('keeps an empty text for a rating only review', () => {
    expect(alertReviewBody({ ...review, text: '' }).text).toBe('');
  });

  it('cuts a long text at the alert limit', () => {
    expect(
      alertReviewBody({ ...review, text: 'x'.repeat(600) }).text,
    ).toHaveLength(REVIEW_ALERT_TEXT_MAX);
  });
});

describe('reviewNegativePayload', () => {
  it('builds the negative review event of an app', () => {
    const occurredAt = new Date('2026-10-28T03:12:00.000Z');

    expect(
      reviewNegativePayload({ id: 'a', name: 'My App' }, review, occurredAt),
    ).toEqual({
      event: 'review.negative',
      occurredAt: '2026-10-28T03:12:00.000Z',
      app: { id: 'a', name: 'My App' },
      review: alertReviewBody(review),
    });
  });
});
