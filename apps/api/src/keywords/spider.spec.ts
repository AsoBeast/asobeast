import { aggregateSpider, SpiderProbeRow, spiderQuery } from './spider';

const row = (
  probe: string,
  results: SpiderProbeRow['results'],
): SpiderProbeRow => ({
  probe,
  results,
});

describe('spiderQuery', () => {
  it('appends the probe letter, or uses the bare term for the empty probe', () => {
    expect(spiderQuery('habit', '')).toBe('habit');
    expect(spiderQuery('habit', 'a')).toBe('habit a');
  });
});

describe('aggregateSpider', () => {
  it('reports 27 as the total and completes only when all probes are in', () => {
    const partial = aggregateSpider('habit', [row('', [])], new Set());
    expect(partial.probesTotal).toBe(27);
    expect(partial.probesDone).toBe(1);
    expect(partial.complete).toBe(false);

    const full = aggregateSpider(
      'habit',
      Array.from({ length: 27 }, (_, i) => row(String(i), [])),
      new Set(),
    );
    expect(full.complete).toBe(true);
  });

  it('merges by text, keeps the max priority, and counts contributing probes', () => {
    const status = aggregateSpider(
      'habit',
      [
        row('', [{ term: 'habit tracker', priority: 10 }]),
        row('a', [{ term: 'habit tracker', priority: 40 }]),
        row('b', [{ term: 'habit tracker' }]),
      ],
      new Set(),
    );

    expect(status.suggestions).toEqual([
      { text: 'habit tracker', priority: 40, probes: 3 },
    ]);
  });

  it('excludes already tracked texts', () => {
    const status = aggregateSpider(
      'habit',
      [
        row('', [
          { term: 'habit tracker', priority: 5 },
          { term: 'daily goals', priority: 9 },
        ]),
      ],
      new Set(['daily goals']),
    );

    expect(status.suggestions.map((s) => s.text)).toEqual(['habit tracker']);
  });

  it('sorts by priority desc then probe count desc', () => {
    const status = aggregateSpider(
      'habit',
      [
        row('', [{ term: 'low', priority: 1 }]),
        row('a', [{ term: 'high', priority: 90 }]),
        row('b', [{ term: 'high', priority: 90 }]),
        row('c', [{ term: 'mid', priority: 90 }]),
      ],
      new Set(),
    );

    expect(status.suggestions.map((s) => s.text)).toEqual([
      'high',
      'mid',
      'low',
    ]);
  });

  it('counts a repeated text within one probe once', () => {
    const status = aggregateSpider(
      'habit',
      [
        row('', [
          { term: 'habit tracker', priority: 3 },
          { term: 'habit tracker', priority: 8 },
        ]),
      ],
      new Set(),
    );

    expect(status.suggestions).toEqual([
      { text: 'habit tracker', priority: 8, probes: 1 },
    ]);
  });
});
