import { reachScore, SuggestReach } from './suggest-reach';

const hit = (prefixLength: number, position: number): SuggestReach => ({
  status: 'hit',
  prefixLength,
  position,
});

describe('reachScore', () => {
  it.each([
    [hit(1, 1), 10],
    [hit(2, 8), 7.11],
    [hit(8, 10), 1.752],
  ])('%j is %s', (reach, expected) => {
    expect(reachScore(reach)).toBeCloseTo(expected, 4);
  });

  it('separates listed, absent and unavailable', () => {
    expect(reachScore({ status: 'listed', position: 3 })).toBe(1.5);
    expect(reachScore({ status: 'absent' })).toBe(0);
    expect(reachScore({ status: 'unavailable' })).toBeNull();
  });

  it('falls with every extra typed character and every lower position', () => {
    const byPrefix = [1, 2, 3, 4, 5, 6, 7, 8].map(
      (length) => reachScore(hit(length, 1)) ?? 0,
    );
    const byPosition = [1, 2, 5, 10].map(
      (position) => reachScore(hit(3, position)) ?? 0,
    );
    expect([...byPrefix].sort((a, b) => b - a)).toEqual(byPrefix);
    expect([...byPosition].sort((a, b) => b - a)).toEqual(byPosition);
  });

  it('never leaves the scale for out of range evidence', () => {
    expect(reachScore(hit(0, 0))).toBe(10);
    expect(reachScore(hit(40, 400))).toBe(0);
  });
});
