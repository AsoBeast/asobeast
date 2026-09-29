import type { ActionContextApp, ActionReview } from '../action-context';
import { scoreImpact } from '../action-impact';
import {
  detectReviewsReplyNegative,
  reviewsReplyNegativeDetector,
} from './reviews-reply-negative';
import { actionContext, contextApp } from './rule-context.fixture';

const NOW = new Date('2026-07-30T03:00:00.000Z');
const DAY_MS = 86_400_000;
const CHECKED = new Date('2026-07-29T03:00:00.000Z');

const review = (
  id: string,
  score: number,
  daysAgo: number,
  overrides: Partial<ActionReview> = {},
): ActionReview => ({
  id,
  score,
  title: null,
  text: 'slow',
  version: '2.0',
  reviewedAt: new Date(NOW.getTime() - daysAgo * DAY_MS),
  repliedAt: null,
  replyCheckedAt: CHECKED,
  ...overrides,
});

const REVIEWS = [
  review('rev_1', 3, 2),
  review('rev_2', 1, 5),
  review('rev_3', 2, 9),
  review('rev_4', 2, 3, { repliedAt: CHECKED }),
  review('rev_5', 5, 1),
];

const app = (
  reviews: ActionReview[] = REVIEWS,
  overrides: Partial<ActionContextApp> = {},
): ActionContextApp =>
  contextApp({
    store: 'GOOGLE_PLAY',
    country: 'de',
    reviews,
    ...overrides,
  });

const detect = (apps: ActionContextApp[]) =>
  detectReviewsReplyNegative(actionContext(apps), NOW);

describe('reviews.reply_negative', () => {
  it('fires with three unanswered low reviews on a Google Play app', () => {
    const [detection] = detect([app()]);

    expect(detection).toEqual({
      rule: 'reviews.reply_negative',
      appId: 'app_1',
      store: 'GOOGLE_PLAY',
      country: 'de',
      keywordId: null,
      discriminator: null,
      terms: { reach: 0.3, severity: 0.5 + 0.5 * (2 / 3), confidence: 1 },
      evidence: {
        rule: 'reviews.reply_negative',
        unanswered: 3,
        checked: 4,
        negative: 4,
        windowDays: 14,
        oldestUnansweredAt: new Date(NOW.getTime() - 9 * DAY_MS).toISOString(),
        replyRate: 0.25,
        sampleReviewIds: ['rev_2', 'rev_3', 'rev_1'],
      },
    });
    expect(scoreImpact(detection.rule, detection.terms)).toEqual({
      impact: 63,
      priority: 'high',
    });
    expect(reviewsReplyNegativeDetector.rule).toBe('reviews.reply_negative');
  });

  it('stays silent with two unanswered reviews', () => {
    expect(
      detect([app(REVIEWS.filter((item) => item.id !== 'rev_1'))]),
    ).toEqual([]);
  });

  it('stays silent while the replies were never checked', () => {
    expect(
      detect([app(REVIEWS.map((item) => ({ ...item, replyCheckedAt: null })))]),
    ).toEqual([]);
  });

  it('stays silent for an App Store app with the same reviews', () => {
    expect(detect([app(REVIEWS, { store: 'APP_STORE' })])).toEqual([]);
  });

  it('lowers confidence by the share of reviews not yet checked', () => {
    const [detection] = detect([
      app([...REVIEWS, review('rev_6', 1, 4, { replyCheckedAt: null })]),
    ]);

    expect(detection.evidence).toMatchObject({ negative: 5, checked: 4 });
    expect(detection.terms.confidence).toBe(0.8);
  });

  it('ignores reviews older than the window and undated reviews', () => {
    expect(
      detect([
        app([
          review('rev_1', 1, 15),
          review('rev_2', 1, 20),
          review('rev_3', 1, 1, { reviewedAt: null }),
          review('rev_4', 2, 2),
          review('rev_5', 2, 3),
        ]),
      ]),
    ).toEqual([]);
  });
});
