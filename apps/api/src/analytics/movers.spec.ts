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
          { position: null, depth: 100, date: BASELINE },
          { position: 4, depth: 200, date: REFERENCE },
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
        to: 4,
        toDepth: 200,
      },
    ]);
  });

  it('ignores a keyword with no baseline capture in the window', () => {
    const result = movers(
      [row([{ position: 4, depth: 200, date: REFERENCE }])],
      REFERENCE,
    );

    expect(result).toEqual({ up: [], down: [] });
  });

  it('ignores a keyword that was not checked on the reference date', () => {
    const result = movers(
      [row([{ position: 4, depth: 200, date: BASELINE }])],
      REFERENCE,
    );

    expect(result).toEqual({ up: [], down: [] });
  });

  it('treats a non-positive baseline as unranked rather than a rank of zero', () => {
    const result = movers(
      [
        row([
          { position: 0, depth: 100, date: BASELINE },
          { position: 4, depth: 200, date: REFERENCE },
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
        to: 4,
        toDepth: 200,
      },
    ]);
    expect(result.down).toEqual([]);
  });

  it('reports no movement between two non-positive captures', () => {
    const result = movers(
      [
        row([
          { position: -1, depth: 200, date: BASELINE },
          { position: 0, depth: 200, date: REFERENCE },
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
          { position: 4, depth: 200, date: BASELINE },
          { position: null, depth: 200, date: REFERENCE },
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
        to: null,
        toDepth: 200,
      },
    ]);
  });
});

describe('rankedMovers', () => {
  const climber = (index: number, from: number | null, to: number) => ({
    ...row([
      { position: from, depth: 200, date: BASELINE },
      { position: to, depth: 200, date: REFERENCE },
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
