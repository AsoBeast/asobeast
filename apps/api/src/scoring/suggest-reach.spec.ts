import { reachScore, SuggestReach, untypedShare } from './suggest-reach';

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

describe('untypedShare', () => {
  it('is the share of the phrase left to type when the store offers it', () => {
    expect(untypedShare(hit(3, 1), 'trivia games')).toBeCloseTo(0.75, 6);
    expect(untypedShare(hit(8, 4), 'map quiz')).toBe(0);
  });

  it('measures the phrase on its search key', () => {
    expect(untypedShare(hit(2, 1), 'Géo  Quiz')).toBeCloseTo(0.75, 6);
  });

  it('counts characters, not code units', () => {
    expect(untypedShare(hit(1, 1), '𠮷野家')).toBeCloseTo(2 / 3, 6);
  });

  it.each([
    [{ status: 'listed', position: 1 }],
    [{ status: 'absent' }],
    [{ status: 'unavailable' }],
  ] as Array<[SuggestReach]>)('is 0 for %j', (reach) => {
    expect(untypedShare(reach, 'trivia games')).toBe(0);
  });

  it('never leaves 0 to 1 for out of range evidence', () => {
    expect(untypedShare(hit(40, 1), 'quiz')).toBe(0);
    expect(untypedShare(hit(0, 1), 'quiz')).toBe(1);
    expect(untypedShare(hit(1, 1), '')).toBe(0);
  });
});
