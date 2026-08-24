import { serpVolatility } from './serp-volatility';

describe('serpVolatility', () => {
  it('returns null for fewer than two snapshots', () => {
    expect(serpVolatility([])).toBeNull();
    expect(serpVolatility([['a', 'b', 'c']])).toBeNull();
  });

  it('scores identical consecutive sets as 0', () => {
    expect(
      serpVolatility([
        ['a', 'b', 'c'],
        ['a', 'b', 'c'],
        ['c', 'b', 'a'],
      ]),
    ).toBe(0);
  });

  it('scores fully disjoint consecutive sets as 100', () => {
    expect(
      serpVolatility([
        ['a', 'b'],
        ['c', 'd'],
        ['e', 'f'],
      ]),
    ).toBe(100);
  });

  it('averages partial overlap across transitions', () => {
    expect(
      serpVolatility([
        ['a', 'b', 'c'],
        ['a', 'b', 'd'],
      ]),
    ).toBe(50);
  });

  it('skips empty sets before pairing', () => {
    expect(serpVolatility([['a', 'b', 'c'], [], ['a', 'b', 'c']])).toBe(0);
    expect(serpVolatility([['a'], []])).toBeNull();
  });
});
