import { describe, expect, it } from 'vitest';

import { DIFFICULTY_DISPLAY_MAX, toDifficulty100 } from './scores';

describe('toDifficulty100', () => {
  it.each([
    [0, 0],
    [4.1, 41],
    [10, DIFFICULTY_DISPLAY_MAX],
    [10.0001, DIFFICULTY_DISPLAY_MAX],
    [48.2, DIFFICULTY_DISPLAY_MAX],
    [-1, 0],
  ])('converts a stored difficulty of %s to %s', (difficulty, expected) => {
    expect(toDifficulty100(difficulty)).toBe(expected);
  });
});
