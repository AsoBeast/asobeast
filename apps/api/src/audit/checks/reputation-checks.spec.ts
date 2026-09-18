import {
  appStoreContext,
  competitor,
  FIXTURE_NOW,
  playContext,
  reviewsFrom,
} from '../audit-context.fixture';
import { DAY_MS } from '../audit-scoring';
import { ratingChecks } from './reputation-checks';

const checkOf = (checks: ReturnType<typeof ratingChecks>, id: string) =>
  checks.find((item) => item.id === id);

const competitorsWith = (counts: number[]) =>
  counts.map((ratingCount, index) =>
    competitor({ id: `c${index}`, ratingCount }),
  );

describe('ratings-volume', () => {
  it('passes 341 ratings against a competitor median of 300', () => {
    const checks = ratingChecks(
      playContext({
        ratingAvg: 4.19,
        ratingCount: 341,
        competitors: competitorsWith([120, 300, 900]),
      }),
    );

    expect(checkOf(checks, 'ratings-volume')).toMatchObject({
      score: 10,
      source: 'competitors',
      detail: 'You have 341 ratings; the median competitor has 300.',
    });
  });

  it.each([
    [0.19, 2],
    [0.2, 4],
    [0.49, 4],
    [0.5, 7],
    [0.99, 7],
    [1, 10],
  ])('scores a ratio of %s to the median as %i', (ratio, score) => {
    const checks = ratingChecks(
      appStoreContext({
        ratingAvg: 4.5,
        ratingCount: ratio * 1000,
        competitors: competitorsWith([1000, 1000]),
      }),
    );

    expect(checkOf(checks, 'ratings-volume')?.score).toBe(score);
  });

  it('falls back to an absolute scale without two benchmarked competitors, and says so', () => {
    const checks = ratingChecks(
      appStoreContext({
        ratingAvg: 4.5,
        ratingCount: 1000,
        competitors: competitorsWith([500]),
      }),
    );

    expect(checkOf(checks, 'ratings-volume')).toMatchObject({
      score: 5,
      source: 'store',
      detail:
        'You have 1000 ratings. Add competitors to compare against your category.',
    });
  });

  it('leaves the volume unanswered without a rating count', () => {
    const checks = ratingChecks(appStoreContext());

    expect(checkOf(checks, 'ratings-volume')).toMatchObject({
      score: null,
      unlock: null,
    });
  });
});

describe('ratings-recent', () => {
  it('waits for 5 reviews from the last 30 days', () => {
    const checks = ratingChecks(
      appStoreContext({ reviews: reviewsFrom(FIXTURE_NOW, [5, 5, 4, 4]) }),
    );

    expect(checkOf(checks, 'ratings-recent')).toMatchObject({
      score: null,
      unlock: {
        kind: 'reviews',
        label: 'Needs 5 reviews from the last 30 days',
      },
    });
  });

  it.each([
    [[5, 5, 4, 4, 4], 10],
    [[5, 4, 4, 4, 3], 7],
    [[4, 4, 3, 3, 2], 4],
    [[2, 2, 2, 1, 1], 1],
  ])('scores %j recent reviews as %i', (scores, score) => {
    const checks = ratingChecks(
      appStoreContext({ reviews: reviewsFrom(FIXTURE_NOW, scores) }),
    );

    expect(checkOf(checks, 'ratings-recent')?.score).toBe(score);
  });

  it('ignores reviews older than 30 days', () => {
    const old = reviewsFrom(
      new Date(FIXTURE_NOW.getTime() - 40 * DAY_MS),
      [5, 5, 5, 5, 5],
    );

    expect(
      checkOf(ratingChecks(appStoreContext({ reviews: old })), 'ratings-recent')
        ?.score,
    ).toBeNull();
  });

  it('names a theme mentioned in at least 3 negative reviews', () => {
    const reviews = [
      ...reviewsFrom(FIXTURE_NOW, [1, 1, 2], 'The ads are everywhere'),
      ...reviewsFrom(FIXTURE_NOW, [5, 5], 'Great game'),
    ];

    expect(
      checkOf(ratingChecks(appStoreContext({ reviews })), 'ratings-recent')
        ?.detail,
    ).toContain('“ads” comes up in 3 of them');
  });
});

describe('ratings-current-version', () => {
  it.each([
    [-0.1, 10],
    [-0.3, 6],
    [-0.4, 2],
  ])('scores a current version delta of %s as %i', (delta, score) => {
    const checks = ratingChecks(
      appStoreContext({
        ratingAvg: 4.5,
        ratingCount: 1000,
        facts: {
          currentVersionScore: 4.5 + delta,
          currentVersionReviews: 20,
        },
      }),
    );

    expect(checkOf(checks, 'ratings-current-version')?.score).toBe(score);
  });

  it('omits the current version check below 5 current version reviews', () => {
    const checks = ratingChecks(
      appStoreContext({
        ratingAvg: 4.5,
        facts: { currentVersionScore: 3.5, currentVersionReviews: 4 },
      }),
    );

    expect(checkOf(checks, 'ratings-current-version')).toBeUndefined();
  });

  it('omits the current version check on Google Play', () => {
    const checks = ratingChecks(
      playContext({
        ratingAvg: 4.5,
        facts: { currentVersionScore: 3.5, currentVersionReviews: 40 },
      }),
    );

    expect(checkOf(checks, 'ratings-current-version')).toBeUndefined();
  });
});
