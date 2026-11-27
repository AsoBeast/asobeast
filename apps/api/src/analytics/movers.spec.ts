import { movers, rankedMovers, UNRANKED_RANK } from './movers';
import type { Ranking, TrackedRow } from './analytics.support';

const REFERENCE = new Date('2026-07-13T00:00:00.000Z');
const BASELINE = new Date('2026-07-06T00:00:00.000Z');

const row = (rankings: Ranking[]): TrackedRow => ({
  keywordId: 'kw_1',
  source: 'TITLE',
  relevance: null,
  keyword: { text: 'focus timer', country: 'us', metrics: [], rankings },
});

describe('movers', () => {
  it('preserves the captured depth for both compared rankings', () => {
    const result = movers(
      [
        row([
          { position: null, depth: 100, date: BASELINE, resultCount: null },
          { position: 4, depth: 200, date: REFERENCE, resultCount: null },
        ]),
      ],
      REFERENCE,
    );

    expect(result.up).toEqual([
      {
        keywordId: 'kw_1',
        text: 'focus timer',
        from: null,
        fromDepth: 100,
        fromResultCount: null,
        to: 4,
        toDepth: 200,
        toResultCount: null,
      },
    ]);
  });

  it('carries the result count of both compared rankings', () => {
    const result = movers(
      [
        row([
          { position: 24, depth: 100, date: BASELINE, resultCount: 30 },
          { position: 11, depth: 200, date: REFERENCE, resultCount: 45 },
        ]),
      ],
      REFERENCE,
    );

    expect(result.up).toEqual([
      {
        keywordId: 'kw_1',
        text: 'focus timer',
        from: 24,
        fromDepth: 100,
        fromResultCount: 30,
        to: 11,
        toDepth: 200,
        toResultCount: 45,
      },
    ]);
  });

  it('maps a null count for a side stored without one', () => {
    const result = movers(
      [
        row([
          { position: 24, depth: 100, date: BASELINE, resultCount: null },
          { position: 11, depth: 200, date: REFERENCE, resultCount: null },
        ]),
      ],
      REFERENCE,
    );

    expect(result.up[0]?.fromResultCount).toBeNull();
    expect(result.up[0]?.toResultCount).toBeNull();
  });

  it('ignores a keyword with no baseline capture in the window', () => {
    const result = movers(
      [row([{ position: 4, depth: 200, date: REFERENCE, resultCount: null }])],
      REFERENCE,
    );

    expect(result).toEqual({ up: [], down: [] });
  });

  it('ignores a keyword that was not checked on the reference date', () => {
    const result = movers(
      [row([{ position: 4, depth: 200, date: BASELINE, resultCount: null }])],
      REFERENCE,
    );

    expect(result).toEqual({ up: [], down: [] });
  });

  it('treats a non-positive baseline as unranked rather than a rank of zero', () => {
    const result = movers(
      [
        row([
          { position: 0, depth: 100, date: BASELINE, resultCount: null },
          { position: 4, depth: 200, date: REFERENCE, resultCount: null },
        ]),
      ],
      REFERENCE,
    );

    expect(result.up).toEqual([
      {
        keywordId: 'kw_1',
        text: 'focus timer',
        from: null,
        fromDepth: 100,
        fromResultCount: null,
        to: 4,
        toDepth: 200,
        toResultCount: null,
      },
    ]);
    expect(result.down).toEqual([]);
  });

  it('reports no movement between two non-positive captures', () => {
    const result = movers(
      [
        row([
          { position: -1, depth: 200, date: BASELINE, resultCount: null },
          { position: 0, depth: 200, date: REFERENCE, resultCount: null },
        ]),
      ],
      REFERENCE,
    );

    expect(result).toEqual({ up: [], down: [] });
  });

  it('still reports a drop out of the captured depth', () => {
    const result = movers(
      [
        row([
          { position: 4, depth: 200, date: BASELINE, resultCount: null },
          { position: null, depth: 200, date: REFERENCE, resultCount: null },
        ]),
      ],
      REFERENCE,
    );

    expect(result.down).toEqual([
      {
        keywordId: 'kw_1',
        text: 'focus timer',
        from: 4,
        fromDepth: 200,
        fromResultCount: null,
        to: null,
        toDepth: 200,
        toResultCount: null,
      },
    ]);
  });
});

describe('rankedMovers', () => {
  const climber = (index: number, from: number | null, to: number) => ({
    ...row([
      { position: from, depth: 200, date: BASELINE, resultCount: null },
      { position: to, depth: 200, date: REFERENCE, resultCount: null },
    ]),
    keywordId: `kw_${index}`,
  });

  it('keeps every climber beyond the top five cut', () => {
    const rows = [20, 19, 18, 17, 16, 15, 14].map((from, index) =>
      climber(index, from, 3),
    );

    expect(rankedMovers(rows, REFERENCE).up).toHaveLength(7);
    expect(movers(rows, REFERENCE).up).toHaveLength(5);
  });

  it('carries the keyword country and the change of each mover', () => {
    const german = climber(1, 12, 4);
    const rows = [
      { ...german, keyword: { ...german.keyword, country: 'de' } },
      climber(2, null, 9),
    ];

    const result = rankedMovers(rows, REFERENCE);

    expect(
      result.up.map(({ keywordId, country, change }) => ({
        keywordId,
        country,
        change,
      })),
    ).toEqual([
      { keywordId: 'kw_2', country: 'us', change: UNRANKED_RANK - 9 },
      { keywordId: 'kw_1', country: 'de', change: 12 - 4 },
    ]);
  });
});
