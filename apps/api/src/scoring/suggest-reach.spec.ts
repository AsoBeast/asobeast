import { reachScore, SuggestReach } from './suggest-reach';

const hit = (prefixLength: number, position: number): SuggestReach => ({
  status: 'hit',
  prefixLength,
  position,
});

describe('reachScore', () => {
  it.each([
    [hit(1, 1), 6.8],
    [hit(2, 8), 4.8],
    [hit(8, 10), 1.6],
  ])('%j is %s', (reach, expected) => {
    expect(reachScore(reach)).toBe(expected);
  });

  it('separates listed, absent and unavailable', () => {
    expect(reachScore({ status: 'listed', position: 3 })).toBe(1);
    expect(reachScore({ status: 'absent' })).toBe(0.9);
    expect(reachScore({ status: 'unavailable' })).toBeNull();
  });

  it('falls with every extra typed character and ignores the position', () => {
    const byPrefix = [1, 2, 3, 4, 5, 6, 7, 8].map(
      (length) => reachScore(hit(length, 1)) ?? 0,
    );
    expect([...byPrefix].sort((a, b) => b - a)).toEqual(byPrefix);
    expect(new Set(byPrefix).size).toBe(byPrefix.length);
    expect(reachScore(hit(3, 1))).toBe(reachScore(hit(3, 10)));
  });

  it('ranks a phrase offered while typed above one offered only in full', () => {
    expect(reachScore(hit(8, 1))).toBeGreaterThan(
      reachScore({ status: 'listed', position: 1 }) ?? 10,
    );
  });

  it('never leaves the table for out of range evidence', () => {
    expect(reachScore(hit(0, 0))).toBe(6.8);
    expect(reachScore(hit(40, 400))).toBe(1.6);
  });
});
