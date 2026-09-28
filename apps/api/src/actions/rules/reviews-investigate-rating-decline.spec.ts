import type { ActionContextApp, ActionReview } from '../action-context';
import { scoreImpact } from '../action-impact';
import {
  detectReviewsInvestigateRatingDecline,
  reviewsInvestigateRatingDeclineDetector,
} from './reviews-investigate-rating-decline';
import { detectReviewsInvestigateTheme } from './reviews-investigate-theme';
import { actionContext, contextApp } from './rule-context.fixture';

const NOW = new Date('2026-07-30T03:00:00.000Z');
const DAY_MS = 86_400_000;

let sequence = 0;

const review = (
  score: number,
  daysAgo: number | null,
  overrides: Partial<ActionReview> = {},
): ActionReview => ({
  id: `rev_${(sequence += 1)}`,
  score,
  title: null,
  text: 'fine',
  version: '4.2.0',
  reviewedAt:
    daysAgo === null ? null : new Date(NOW.getTime() - daysAgo * DAY_MS),
  ...overrides,
});

const reviews = (scores: number[], daysAgo: number): ActionReview[] =>
  scores.map((score, index) => review(score, daysAgo + index * 0.1));

const BASELINE = [5, 5, 5, 4, 4, 4];
const RECENT = [5, 4, 4, 4, 4, 4, 2, 1];

const app = (
  recent: number[] = RECENT,
  baseline: number[] = BASELINE,
  overrides: Partial<ActionContextApp> = {},
): ActionContextApp =>
  contextApp({
    reviews: [...reviews(recent, 1), ...reviews(baseline, 20)],
    latestVersion: '4.2.0',
    ...overrides,
  });

const detect = (apps: ActionContextApp[]) =>
  detectReviewsInvestigateRatingDecline(actionContext(apps), NOW);

describe('reviews.investigate_rating_decline', () => {
  beforeEach(() => {
    sequence = 0;
  });

  it('fires when recent scores fell against the baseline', () => {
    const [detection] = detect([app()]);

    expect(detection).toEqual({
      rule: 'reviews.investigate_rating_decline',
      appId: 'app_1',
      store: 'APP_STORE',
      country: 'us',
      keywordId: null,
      discriminator: null,
      terms: { reach: 0.4, severity: 2 / 3, confidence: 0.3 },
      evidence: {
        rule: 'reviews.investigate_rating_decline',
        recentAverage: 3.5,
        baselineAverage: 4.5,
        drop: 1,
        recentReviews: 8,
        baselineReviews: 6,
        recentDays: 14,
        baselineDays: 21,
        latestVersion: '4.2.0',
        negativeShare: 0.25,
        sampleReviewIds: ['rev_7', 'rev_8'],
      },
    });
    expect(scoreImpact(detection.rule, detection.terms)).toEqual({
      impact: 47,
      priority: 'medium',
    });
    expect(reviewsInvestigateRatingDeclineDetector.rule).toBe(
      'reviews.investigate_rating_decline',
    );
  });

  it('fires at exactly the minimum drop', () => {
    const [detection] = detect([app([4, 4, 4, 4, 4, 4, 4, 4])]);

    expect(detection.evidence).toMatchObject({ drop: 0.5 });
  });

  it('stays silent just below the minimum drop', () => {
    expect(detect([app([4, 4, 4, 4, 4, 4, 4, 3], [5, 5, 4, 4, 4, 4])])).toEqual(
      [],
    );
  });

  it('stays silent with four recent reviews', () => {
    expect(detect([app([2, 2, 1, 1])])).toEqual([]);
  });

  it('stays silent with four baseline reviews', () => {
    expect(detect([app(RECENT, [5, 5, 5, 5])])).toEqual([]);
  });

  it('keeps the five most recent negative reviews as samples', () => {
    const [detection] = detect([app([1, 1, 2, 1, 2, 1, 2, 5])]);

    expect(detection.evidence).toMatchObject({
      negativeShare: 0.88,
      sampleReviewIds: ['rev_1', 'rev_2', 'rev_3', 'rev_4', 'rev_5'],
    });
  });

  it('ignores reviews without a date', () => {
    const undated = app();
    undated.reviews.push(...Array.from({ length: 10 }, () => review(5, null)));

    const [detection] = detect([undated]);

    expect(detection.evidence).toMatchObject({
      recentReviews: 8,
      baselineReviews: 6,
    });
  });

  it('withholds the decline while a review theme explains it', () => {
    const crash = { text: 'crashes on launch every time' };
    const themed = app(RECENT, BASELINE, {
      previousVersion: '4.1.0',
      reviews: [
        review(1, 1, crash),
        review(1, 1.1, crash),
        review(2, 1.2, crash),
        ...reviews([5, 4, 4, 4, 4], 2),
        review(1, 20, { version: '4.1.0', text: 'too many adverts' }),
        ...reviews([5, 5, 5, 5, 5], 20).map((item) => ({
          ...item,
          version: '4.1.0',
        })),
      ],
    });
    const context = actionContext([themed]);

    expect(detectReviewsInvestigateTheme(context, NOW)).not.toEqual([]);
    const [detection] = detectReviewsInvestigateRatingDecline(context, NOW);
    expect(detection.withheld).toBe(true);
  });
});
