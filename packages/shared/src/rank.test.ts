import { describe, expect, it } from 'vitest';

import { formatRankPosition, isRanked } from './rank';

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
