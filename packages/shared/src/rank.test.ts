import { describe, expect, it } from 'vitest';

import {
  CHECK_FRESH_DAYS,
  formatCheckedPosition,
  formatRankPosition,
  isCheckFresh,
  isRanked,
  listsNoApps,
  NO_APPS_LABEL,
  NO_APPS_SENTENCE,
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

describe('listsNoApps', () => {
  it.each([
    [0, true],
    [1, false],
    [183, false],
    [null, false],
    [undefined, false],
  ])(
    'reports a result count of %s as listing no apps: %s',
    (count, expected) => {
      expect(listsNoApps(count)).toBe(expected);
    },
  );

  it('carries the label and the sentence', () => {
    expect(NO_APPS_LABEL).toBe('No apps');
    expect(NO_APPS_SENTENCE).toBe('The store lists no apps for this search');
  });
});

describe('formatRankPosition', () => {
  it.each([
    [1, undefined, undefined, '1'],
    [200, undefined, undefined, '200'],
    [0, undefined, undefined, '>200'],
    [-1, 100, undefined, '>100'],
    [null, undefined, undefined, '>200'],
    [undefined, undefined, undefined, '>200'],
    [null, 100, undefined, '>100'],
  ])(
    'formats position %s at depth %s and count %s as %s',
    (position, depth, resultCount, expected) => {
      expect(formatRankPosition(position, depth, resultCount)).toBe(expected);
    },
  );

  it.each([
    [null, undefined, 0, NO_APPS_LABEL],
    [null, 100, 0, NO_APPS_LABEL],
    [undefined, undefined, 0, NO_APPS_LABEL],
    [null, undefined, 1, '>200'],
    [null, undefined, 183, '>200'],
    [null, undefined, null, '>200'],
    [null, undefined, undefined, '>200'],
    [undefined, 100, null, '>100'],
    [1, undefined, 0, '1'],
    [14, 100, 0, '14'],
  ])(
    'reads position %s at depth %s with a result count of %s as %s',
    (position, depth, resultCount, expected) => {
      expect(formatRankPosition(position, depth, resultCount)).toBe(expected);
    },
  );
});

describe('formatCheckedPosition', () => {
  it.each([
    [1, 200, undefined, '1'],
    [null, 200, undefined, '>200'],
    [null, 100, undefined, '>100'],
  ])(
    'formats the checked position %s at depth %s and count %s as %s',
    (position, depth, resultCount, expected) => {
      expect(formatCheckedPosition(position, depth, resultCount)).toBe(
        expected,
      );
    },
  );

  it('reports a keyword that was never checked as unformattable', () => {
    expect(formatCheckedPosition(null, null)).toBeNull();
  });

  it('passes the result count through to the bound', () => {
    expect(formatCheckedPosition(null, 200, 0)).toBe(NO_APPS_LABEL);
    expect(formatCheckedPosition(null, 200, null)).toBe('>200');
    expect(formatCheckedPosition(null, 200, 45)).toBe('>200');
    expect(formatCheckedPosition(14, 200, 0)).toBe('14');
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
