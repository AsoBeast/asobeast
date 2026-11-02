import { describe, expect, it } from 'vitest';
import {
  listsReviewScore,
  normalizeReviewScores,
  reviewScoresLabel,
  selectedReviewScores,
} from './review-scores';

describe('normalizeReviewScores', () => {
  it.each([
    [
      [2, 1, 2],
      [1, 2],
    ],
    [[5, 4, 3, 2, 1], []],
    [
      [1, 2, 3, 4, 5, 7],
      [1, 2, 3, 4, 5, 7],
    ],
    [[], []],
  ])('normalizes %j to %j', (raw, expected) => {
    expect(normalizeReviewScores(raw)).toEqual(expected);
  });
});

describe('listsReviewScore', () => {
  it('lists every score when the filter is empty or absent', () => {
    expect(listsReviewScore([], 3)).toBe(true);
    expect(listsReviewScore(undefined, 3)).toBe(true);
  });

  it('lists only the scores the filter holds', () => {
    expect(listsReviewScore([1, 2], 2)).toBe(true);
    expect(listsReviewScore([1, 2], 5)).toBe(false);
  });
});

describe('selectedReviewScores', () => {
  it.each([
    [[], [1, 2, 3, 4, 5]],
    [undefined, [1, 2, 3, 4, 5]],
    [
      [4, 2],
      [2, 4],
    ],
    [[9], [1, 2, 3, 4, 5]],
  ])('shows %j ticked as %j', (stored, expected) => {
    expect(selectedReviewScores(stored)).toEqual(expected);
  });
});

describe('reviewScoresLabel', () => {
  it.each([
    [[], 'every star'],
    [[1], '1 star'],
    [[5], '5 stars'],
    [[1, 2], '1 and 2 stars'],
    [[4, 5], '4 and 5 stars'],
    [[1, 2, 3], '1 to 3 stars'],
    [[1, 3, 5], '1, 3 and 5 stars'],
    [[2, 3, 4, 5], '2 to 5 stars'],
  ])('words %j as %s', (scores, expected) => {
    expect(reviewScoresLabel(scores)).toBe(expected);
  });
});
