import { describe, expect, it } from 'vitest';
import {
  RATING_DROP_DEFAULT_TENTHS,
  RATING_DROP_TENTHS_CHOICES,
  isRatingDropTenths,
  listsRatingDrop,
  ratingDropLabel,
} from './rating-drop';

describe('rating drop tenths', () => {
  it('defaults to one tenth and offers valid choices', () => {
    expect(RATING_DROP_DEFAULT_TENTHS).toBe(1);
    expect(RATING_DROP_TENTHS_CHOICES).toEqual([1, 2, 3, 5]);
    for (const choice of RATING_DROP_TENTHS_CHOICES) {
      expect(isRatingDropTenths(choice)).toBe(true);
    }
  });

  it.each([
    [1, true],
    [10, true],
    [0, false],
    [11, false],
    [1.5, false],
    [-1, false],
    ['2', false],
    [null, false],
    [undefined, false],
    [Number.NaN, false],
  ])('judges %p as %p', (value, expected) => {
    expect(isRatingDropTenths(value)).toBe(expected);
  });

  it('lists a drop at or above the wanted tenths, clamped to the default', () => {
    expect(listsRatingDrop(undefined, 1)).toBe(true);
    expect(listsRatingDrop(null, 1)).toBe(true);
    expect(listsRatingDrop(undefined, 0)).toBe(false);
    expect(listsRatingDrop(0, 1)).toBe(true);
    expect(listsRatingDrop(0, 0)).toBe(false);
    expect(listsRatingDrop(3, 2)).toBe(false);
    expect(listsRatingDrop(3, 3)).toBe(true);
    expect(listsRatingDrop(3, 5)).toBe(true);
  });

  it.each([
    [1, '0.1 star'],
    [2, '0.2 stars'],
    [5, '0.5 stars'],
    [10, '1 star'],
  ])('labels %p tenths as %p', (tenths, label) => {
    expect(ratingDropLabel(tenths)).toBe(label);
  });
});
