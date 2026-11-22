import { RANK_DEPTH, visibility } from '@asobeast/shared';
import {
  addDays,
  keywordsAt,
  Ranking,
  toDateKey,
  TrackedRow,
  visibilityPoints,
} from './analytics.support';
import { keywordsNow } from './baseline';

const DAY_13 = new Date('2026-07-13T00:00:00Z');
const DAY_12 = new Date('2026-07-12T00:00:00Z');
const DAY_09 = new Date('2026-07-09T00:00:00Z');
const DAY_08 = new Date('2026-07-08T00:00:00Z');

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
    expect(visibilityPoints(midRun, DAY_13).at(-1)).toEqual({
      date: '2026-07-13',
      visibility: visibilityOf([2, 6, 8, 30]),
    });
  });

  it('keeps every older point on its own day', () => {
    const missedDay = [
      ...midRun.slice(0, 2),
      row('c', 5, [check(8, DAY_08), check(8, DAY_12)]),
      midRun[3],
    ];

    expect(visibilityPoints(missedDay, DAY_13).slice(1, -1)).toEqual([
      { date: '2026-07-09', visibility: visibilityOf([2, 6, null, 30]) },
      { date: '2026-07-12', visibility: visibilityOf([2, 6, 8, 30]) },
    ]);
  });

  it('reads the last day of a window that ends before the reference day exactly', () => {
    expect(visibilityPoints(midRun, addDays(DAY_13, 1)).at(-1)).toEqual({
      date: '2026-07-13',
      visibility: visibilityOf([2, null, null, 30]),
    });
  });

  it('never carries a check two days old into the newest point', () => {
    const stale = [
      row('a', 9, [check(2, DAY_13)]),
      row('b', 8, [check(6, DAY_09)]),
    ];

    expect(visibilityPoints(stale, DAY_13).at(-1)?.visibility).toBe(
      visibility([
        { traffic: 9, position: 2 },
        { traffic: 8, position: null },
      ]),
    );
  });
});

describe('visibilityPoints over a long history', () => {
  const FIRST = new Date('2026-05-15T00:00:00Z');
  const DAYS = 60;
  const longHistory = Array.from({ length: 20 }, (_, index): TrackedRow => {
    const checks = Array.from({ length: DAYS }, (_, day) => day)
      .filter((day) => (day + index) % 7 !== 0)
      .filter((day) => !(index % 4 === 0 && day === DAYS - 1))
      .map((day) =>
        check(
          day % 11 === index % 11 ? null : 1 + ((index * 17 + day) % 120),
          addDays(FIRST, day),
        ),
      );
    return {
      keywordId: `kw_${index}`,
      source: 'MANUAL',
      relevance: null,
      keyword: {
        text: `kw ${index}`,
        country: 'us',
        metrics: Array.from({ length: 6 }, (_, step) => ({
          traffic: 5 + ((index + step * 3) % 40),
          difficulty: 20,
          date: addDays(FIRST, 50 - step * 10),
        })),
        rankings: [...checks].sort(
          (a, b) => b.date.getTime() - a.date.getTime(),
        ),
      },
    };
  });

  const expectedPoints = (rows: TrackedRow[]) => {
    const times = [
      ...new Set(
        rows.flatMap((row) =>
          row.keyword.rankings.map((ranking) => ranking.date.getTime()),
        ),
      ),
    ].sort((a, b) => a - b);
    return times.map((time, index) => {
      const date = new Date(time);
      const keywords =
        index === times.length - 1
          ? keywordsNow(rows, date)
          : keywordsAt(rows, date);
      return { date: toDateKey(date), visibility: visibility(keywords) };
    });
  };

  it('draws the same points from the index as from the lists', () => {
    const points = visibilityPoints(longHistory, addDays(FIRST, DAYS - 1));

    expect(points).toHaveLength(DAYS);
    expect(points).toEqual(expectedPoints(longHistory));
  });
});
