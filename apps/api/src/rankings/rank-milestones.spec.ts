import { overtaken, positionAlert, rankMilestone } from './rank-milestones';

const entered = (tier: number) => ({ tier, direction: 'entered' });
const left = (tier: number) => ({ tier, direction: 'left' });

describe('rankMilestone', () => {
  it.each([
    [15, 8, entered(10)],
    [15, 2, entered(3)],
    [15, 1, entered(1)],
    [4, 3, entered(3)],
    [2, 1, entered(1)],
    [null, 9, entered(10)],
    [11, 10, entered(10)],
    [8, 15, left(10)],
    [2, 15, left(10)],
    [2, 5, left(3)],
    [1, 4, left(3)],
    [1, 2, left(1)],
    [1, null, left(10)],
    [10, 11, left(10)],
    [5, 4, null],
    [3, 2, null],
    [1, 1, null],
    [11, 200, null],
    [null, null, null],
    [null, 11, null],
  ])('reads a move from %p to %p as %p', (from, to, expected) => {
    expect(rankMilestone(from, to)).toEqual(expected);
  });
});

describe('overtaken', () => {
  it.each([
    [{ app: 5, competitor: 9 }, { app: 6, competitor: 4 }, true],
    [{ app: 5, competitor: null }, { app: 6, competitor: 4 }, true],
    [{ app: 5, competitor: 9 }, { app: null, competitor: 4 }, true],
    [{ app: 5, competitor: null }, { app: null, competitor: 150 }, true],
    [{ app: 5, competitor: 9 }, { app: 5, competitor: 9 }, false],
    [{ app: 9, competitor: 5 }, { app: 10, competitor: 4 }, false],
    [{ app: null, competitor: 9 }, { app: null, competitor: 4 }, false],
    [{ app: 5, competitor: 9 }, { app: 3, competitor: 4 }, false],
    [{ app: 5, competitor: 9 }, { app: 6, competitor: null }, false],
    [{ app: 5, competitor: 5 }, { app: 6, competitor: 4 }, false],
  ])('reads %p then %p as an overtake: %p', (previous, current, expected) => {
    expect(overtaken(previous, current)).toBe(expected);
  });
});

describe('positionAlert', () => {
  it.each([
    [null, 37, false, { event: 'rank.first', position: 37 }],
    [null, 8, false, { event: 'rank.first', position: 8 }],
    [null, 8, true, { event: 'rank.milestone', milestone: entered(10) }],
    [null, 37, true, null],
    [14, 8, false, { event: 'rank.milestone', milestone: entered(10) }],
    [5, null, false, { event: 'rank.milestone', milestone: left(10) }],
    [null, null, false, null],
  ])(
    'reads %p to %p, ranked earlier %p, as %p',
    (from, to, rankedEarlier, expected) => {
      expect(positionAlert(from, to, rankedEarlier)).toEqual(expected);
    },
  );
});
