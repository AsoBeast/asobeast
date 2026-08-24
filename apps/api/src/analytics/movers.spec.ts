import { movers } from './movers';
import type { Ranking, TrackedRow } from './analytics.support';

const REFERENCE = new Date('2026-07-13T00:00:00.000Z');
const BASELINE = new Date('2026-07-06T00:00:00.000Z');

const row = (rankings: Ranking[]): TrackedRow => ({
  keywordId: 'kw_1',
  source: 'TITLE',
  relevance: null,
  keyword: { text: 'focus timer', metrics: [], rankings },
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
