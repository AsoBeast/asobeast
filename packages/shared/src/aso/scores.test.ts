import { describe, expect, it } from 'vitest';

import { SCORE_DISPLAY_MAX, toDifficulty100, toVolume } from './scores';

describe.each([
  ['toVolume', toVolume],
  ['toDifficulty100', toDifficulty100],
])('%s', (_, toDisplay) => {
  it.each([
    [0, 0],
    [4.1, 41],
    [10, SCORE_DISPLAY_MAX],
    [10.0001, SCORE_DISPLAY_MAX],
    [48.2, SCORE_DISPLAY_MAX],
    [-1, 0],
  ])('converts a stored score of %s to %s', (score, expected) => {
    expect(toDisplay(score)).toBe(expected);
  });
});
