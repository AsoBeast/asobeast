import { dropStreakOf } from './keyword-drop-streak';

const checks = (positions: (number | null)[]) =>
  positions.map((position) => ({ position }));

describe('dropStreakOf', () => {
  it.each<[string, (number | null)[], number]>([
    ['no check', [], 0],
    ['a single check', [5], 0],
    ['an unchanged position', [5, 5], 0],
    ['one fall', [7, 5], 1],
    ['three falls in a row', [9, 7, 5, 3], 3],
    ['a run ended by an equal pair', [9, 7, 5, 5, 3], 2],
    ['a run ended by an improvement', [9, 7, 8, 3], 1],
    ['not found after a ranked position', [null, 40, 20, 10], 3],
    ['two not found checks', [null, null, 40], 0],
    ['a recovery from not found', [40, null, 10], 0],
  ])('answers the streak for %s', (_case, positions, streak) => {
    expect(dropStreakOf(checks(positions))).toBe(streak);
  });

  it('answers at most one less than the number of checks', () => {
    const falling = Array.from({ length: 60 }, (_, index) => 60 - index);
    expect(dropStreakOf(checks(falling))).toBe(59);
  });
});
