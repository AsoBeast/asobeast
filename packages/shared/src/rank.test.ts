import { describe, expect, it } from 'vitest';

import {
  CHECK_FRESH_DAYS,
  formatCheckedPosition,
  formatRankPosition,
  isCheckFresh,
  isRanked,
  RANK_DEPTH,
  RANK_MILESTONE_DIRECTIONS,
  RANK_MILESTONE_TIERS,
  tierOf,
} from './rank';

describe('isRanked', () => {
  it.each([
    [1, true],
    [200, true],
    [0, false],
    [-1, false],
    [null, false],
    [undefined, false],
  ])('reports %s as ranked: %s', (position, expected) => {
    expect(isRanked(position)).toBe(expected);
  });
});

describe('formatRankPosition', () => {
  it.each([
    [1, undefined, '1'],
    [200, undefined, '200'],
    [0, undefined, '>200'],
    [-1, 100, '>100'],
    [null, undefined, '>200'],
    [undefined, undefined, '>200'],
    [null, 100, '>100'],
  ])('formats position %s at depth %s as %s', (position, depth, expected) => {
    expect(formatRankPosition(position, depth)).toBe(expected);
  });
});

describe('formatCheckedPosition', () => {
  it.each([
    [1, 200, '1'],
    [null, 200, '>200'],
    [null, 100, '>100'],
  ])(
    'formats the checked position %s at depth %s as %s',
    (position, depth, expected) => {
      expect(formatCheckedPosition(position, depth)).toBe(expected);
    },
  );

  it('reports a keyword that was never checked as unformattable', () => {
    expect(formatCheckedPosition(null, null)).toBeNull();
  });
});

describe('rank milestones', () => {
  it('names the first result, the first screen and the first page', () => {
    expect(RANK_MILESTONE_TIERS).toEqual([1, 3, 10]);
    expect(RANK_MILESTONE_DIRECTIONS).toEqual(['entered', 'left']);
  });

  it('keeps the tiers distinct, ascending and inside the captured depth', () => {
    const tiers = [...RANK_MILESTONE_TIERS];
    expect([...tiers].sort((left, right) => left - right)).toEqual(tiers);
    expect(new Set(tiers).size).toBe(tiers.length);
    expect(Math.min(...tiers)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...tiers)).toBeLessThanOrEqual(RANK_DEPTH);
  });

  it.each([
    [1, 1],
    [2, 3],
    [3, 3],
    [4, 10],
    [10, 10],
    [11, null],
    [200, null],
    [0, null],
    [null, null],
    [undefined, null],
  ])('places position %s in tier %s', (position, expected) => {
    expect(tierOf(position)).toBe(expected);
  });
});

describe('isCheckFresh', () => {
  it('treats a check from today or yesterday as current', () => {
    expect(isCheckFresh('2026-10-22', '2026-10-22')).toBe(true);
    expect(isCheckFresh('2026-10-21', '2026-10-22')).toBe(true);
  });

  it('treats an older check as stale', () => {
    expect(isCheckFresh('2026-10-20', '2026-10-22')).toBe(false);
  });

  it('crosses month and year boundaries', () => {
    expect(isCheckFresh('2026-09-30', '2026-10-01')).toBe(true);
    expect(isCheckFresh('2025-12-30', '2026-01-01')).toBe(false);
  });

  it('allows one day of slack for the daily run', () => {
    expect(CHECK_FRESH_DAYS).toBe(1);
  });
});
