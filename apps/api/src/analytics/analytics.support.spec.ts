import { RANK_DEPTH, visibility } from '@asobeast/shared';
import { Ranking, TrackedRow, visibilityPoints } from './analytics.support';

const DAY_13 = new Date('2026-07-13T00:00:00Z');
const DAY_12 = new Date('2026-07-12T00:00:00Z');
const DAY_09 = new Date('2026-07-09T00:00:00Z');

const check = (position: number | null, date: Date): Ranking => ({
  position,
  depth: RANK_DEPTH,
  date,
});

const row = (
  keywordId: string,
  traffic: number,
  checks: Ranking[],
): TrackedRow => ({
  keywordId,
  source: 'MANUAL',
  relevance: null,
  keyword: {
    text: keywordId,
    country: 'us',
    metrics: [{ traffic, difficulty: 10, date: DAY_09 }],
    rankings: [...checks].sort((a, b) => b.date.getTime() - a.date.getTime()),
  },
});

const midRun = [
  row('a', 9, [check(2, DAY_09), check(2, DAY_12), check(2, DAY_13)]),
  row('b', 8, [check(6, DAY_09), check(6, DAY_12)]),
  row('c', 5, [check(8, DAY_12)]),
  row('d', 7, [check(30, DAY_09), check(30, DAY_12), check(30, DAY_13)]),
];

const visibilityOf = (positions: Array<number | null>) =>
  visibility(
    positions.map((position, index) => ({
      traffic: [9, 8, 5, 7][index],
      position,
    })),
  );

describe('visibilityPoints', () => {
  it('draws the newest point with the keywords still waiting for their check at the day before', () => {
    expect(visibilityPoints(midRun).at(-1)).toEqual({
      date: '2026-07-13',
      visibility: visibilityOf([2, 6, 8, 30]),
    });
  });

  it('keeps every older point on its own day', () => {
    expect(visibilityPoints(midRun).slice(0, -1)).toEqual([
      { date: '2026-07-09', visibility: visibilityOf([2, 6, null, 30]) },
      { date: '2026-07-12', visibility: visibilityOf([2, 6, 8, 30]) },
    ]);
  });

  it('never carries a check two days old into the newest point', () => {
    const stale = [
      row('a', 9, [check(2, DAY_13)]),
      row('b', 8, [check(6, DAY_09)]),
    ];

    expect(visibilityPoints(stale).at(-1)?.visibility).toBe(
      visibility([
        { traffic: 9, position: 2 },
        { traffic: 8, position: null },
      ]),
    );
  });
});
