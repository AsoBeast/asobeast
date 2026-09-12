import { describe, expect, it } from 'vitest';

import { toDifficulty100, toVolume } from './scores';

describe.each([
  ['toVolume', toVolume],
  ['toDifficulty100', toDifficulty100],
])('%s', (_, toDisplay) => {
  it.each([
    [0, 0],
    [4.1, 41],
    [10, 100],
    [10.0001, 100],
    [48.2, 100],
    [-1, 0],
  ])('converts a stored score of %s to %s', (score, expected) => {
    expect(toDisplay(score)).toBe(expected);
  });
});
