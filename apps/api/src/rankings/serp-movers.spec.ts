import { detectEntrants, SerpSnapshotDay } from './serp-movers';

const day = (date: string, apps: [number, string][]): SerpSnapshotDay => ({
  date,
  entries: apps.map(([position, storeAppId]) => ({
    position,
    storeAppId,
    title: storeAppId.toUpperCase(),
  })),
});

describe('detectEntrants', () => {
  it('excludes the first day and reports entrants on later days', () => {
    const entrants = detectEntrants([
      day('2026-07-01', [
        [1, 'a'],
        [2, 'b'],
      ]),
      day('2026-07-02', [
        [1, 'a'],
        [2, 'c'],
      ]),
    ]);
    expect(entrants).toEqual([
      { date: '2026-07-02', position: 2, storeAppId: 'c', title: 'C' },
    ]);
  });

  it('returns nothing for a single snapshot', () => {
    expect(detectEntrants([day('2026-07-01', [[1, 'a']])])).toEqual([]);
  });

  it('treats consecutive available snapshots as adjacent across a gap', () => {
    const entrants = detectEntrants([
      day('2026-07-01', [[1, 'a']]),
      day('2026-07-05', [
        [1, 'a'],
        [2, 'b'],
      ]),
    ]);
    expect(entrants).toEqual([
      { date: '2026-07-05', position: 2, storeAppId: 'b', title: 'B' },
    ]);
  });

  it('reports multiple entrants on the same day', () => {
    const entrants = detectEntrants([
      day('2026-07-01', [[1, 'a']]),
      day('2026-07-02', [
        [1, 'x'],
        [2, 'y'],
      ]),
    ]);
    expect(entrants).toEqual([
      { date: '2026-07-02', position: 1, storeAppId: 'x', title: 'X' },
      { date: '2026-07-02', position: 2, storeAppId: 'y', title: 'Y' },
    ]);
  });

  it('sorts unordered snapshots before pairing', () => {
    const entrants = detectEntrants([
      day('2026-07-02', [
        [1, 'a'],
        [2, 'c'],
      ]),
      day('2026-07-01', [
        [1, 'a'],
        [2, 'b'],
      ]),
    ]);
    expect(entrants).toEqual([
      { date: '2026-07-02', position: 2, storeAppId: 'c', title: 'C' },
    ]);
  });
});
