import { positionWeight } from '@asobeast/shared';
import {
  drop,
  firstRanking,
  improvement,
  milestone,
  overtake,
} from './rank-events.fixture';
import {
  byImpact,
  compareImpact,
  impactOfPayload,
  moveImpact,
} from './rank-impact';

const round = (value: number) => Math.round(value * 100) / 100;

describe('moveImpact', () => {
  it.each([
    [60, 9, 11, 1.33],
    [20, 3, 30, 5.96],
    [60, 12, 8, 2.71],
    [null, 1, 4, 0.57],
  ])('weighs %p traffic from %p to %p as %p', (traffic, from, to, impact) => {
    expect(round(moveImpact({ traffic, from, to }))).toBe(impact);
  });

  it('counts leaving or entering the checked depth as the whole weight', () => {
    expect(moveImpact({ traffic: 40, from: 5, to: null })).toBe(
      40 * positionWeight(5),
    );
    expect(moveImpact({ traffic: 40, from: null, to: 5 })).toBe(
      40 * positionWeight(5),
    );
  });
});

describe('impactOfPayload', () => {
  const keyword = (id: string) => ({ ...drop().keyword, id });
  const traffic = new Map([['k', 40]]);

  it.each([
    ['a drop', drop({ keyword: keyword('k'), from: 3, to: 9 })],
    ['a climb', improvement({ keyword: keyword('k'), from: 9, to: 3 })],
    ['a milestone', milestone({ keyword: keyword('k'), from: 9, to: 3 })],
    ['an overtake', overtake({ keyword: keyword('k'), from: 3, to: 9 })],
  ])('weighs %s by its own move', (_name, payload) => {
    expect(impactOfPayload(payload, traffic)).toBe(
      moveImpact({ traffic: 40, from: 3, to: 9 }),
    );
  });

  it('weighs a first ranking by the weight it gained', () => {
    expect(
      impactOfPayload(
        firstRanking({ keyword: keyword('k'), position: 4 }),
        traffic,
      ),
    ).toBe(40 * positionWeight(4));
  });
});

describe('compareImpact', () => {
  const at = (id: string, text: string, from: number, to: number) =>
    drop({ keyword: { ...drop().keyword, id, text }, from, to });

  it('orders by impact, then keyword text, then keyword id', () => {
    const big = at('k1', 'zeta', 1, 20);
    const tieB = at('k3', 'alpha', 5, 9);
    const tieA = at('k2', 'alpha', 5, 9);
    const small = at('k4', 'beta', 30, 31);

    expect([small, tieB, big, tieA].sort(compareImpact(new Map()))).toEqual([
      big,
      tieA,
      tieB,
      small,
    ]);
  });

  it('keeps arrival order without traffic', () => {
    const moves = [at('k1', 'a', 30, 31), at('k2', 'b', 1, 20)];

    expect(byImpact(moves, undefined)).toEqual(moves);
  });
});
