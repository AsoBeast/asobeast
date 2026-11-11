import { RANK_DEPTH } from '@asobeast/shared';
import { TrackedRow } from './analytics.support';
import { HistoryMember, portfolioHistory } from './portfolio-history';

const TODAY = new Date('2026-07-13T00:00:00Z');

const daysAgo = (days: number, from = TODAY): Date =>
  new Date(from.getTime() - days * 24 * 60 * 60 * 1000);

const row = (
  keywordId: string,
  traffic: number,
  checks: Array<[daysAgo: number, position: number | null]>,
  reference = TODAY,
): TrackedRow => ({
  keywordId,
  source: 'MANUAL',
  relevance: null,
  keyword: {
    text: keywordId,
    country: 'us',
    metrics: [{ traffic, difficulty: 10, date: daysAgo(200, reference) }],
    rankings: checks.map(([ago, position]) => ({
      position,
      depth: RANK_DEPTH,
      date: daysAgo(ago, reference),
    })),
  },
});

let nextApp = 0;

const app = (
  rows: TrackedRow[],
  referenceDate: Date | null = TODAY,
): HistoryMember => {
  nextApp += 1;
  return { appId: `app_${nextApp}`, rows, referenceDate };
};

const QUIET = {
  compared: false,
  visibilityDelta: null,
  top10Delta: null,
  movement: { up: 0, down: 0, entered: 0, lost: 0 },
  appsMoved: 0,
  movers: { up: [], down: [] },
};

describe('portfolioHistory', () => {
  it('answers no points before any app was checked', () => {
    expect(portfolioHistory([app([], null)], 30)).toEqual({
      days: 30,
      points: [],
      previous: [],
      change: QUIET,
    });
  });

  it('scores each checked day and counts the keywords in the top 10', () => {
    const history = portfolioHistory(
      [
        app([
          row('a', 10, [
            [0, 1],
            [1, 3],
          ]),
          row('b', 10, [
            [0, 40],
            [1, 8],
          ]),
        ]),
      ],
      7,
    );

    expect(history.points.map(({ date, top10 }) => ({ date, top10 }))).toEqual([
      { date: '2026-07-12', top10: 2 },
      { date: '2026-07-13', top10: 1 },
    ]);
    expect(history.points[1].visibility).toBeGreaterThan(0);
    expect(history.previous).toEqual([]);
  });

  it('counts a move against the previous checked day of the same app', () => {
    const history = portfolioHistory(
      [
        app([
          row('climbs', 10, [
            [0, 4],
            [2, 9],
          ]),
          row('falls', 10, [
            [0, 30],
            [2, 12],
          ]),
          row('holds', 10, [
            [0, 5],
            [2, 5],
          ]),
          row('enters', 10, [
            [0, 150],
            [2, null],
          ]),
          row('drops out', 10, [
            [0, null],
            [2, 180],
          ]),
          row('checked once', 10, [[0, 2]]),
        ]),
      ],
      7,
    );

    expect(history.points).toHaveLength(2);
    expect(history.points[0]).toMatchObject({
      date: '2026-07-11',
      climbed: 0,
      fell: 0,
    });
    expect(history.points[1]).toMatchObject({
      date: '2026-07-13',
      climbed: 2,
      fell: 2,
    });
  });

  it('puts the days before the window in the previous period', () => {
    const history = portfolioHistory(
      [
        app([
          row('a', 10, [
            [0, 1],
            [6, 1],
            [7, 3],
            [13, 3],
            [14, 3],
          ]),
        ]),
      ],
      7,
    );

    expect(history.points.map((point) => point.date)).toEqual([
      '2026-07-07',
      '2026-07-13',
    ]);
    expect(history.previous.map((point) => point.date)).toEqual([
      '2026-06-30',
      '2026-07-06',
    ]);
    expect(history.points[0].climbed).toBe(1);
    expect(history.previous[0].climbed).toBe(0);
  });

  it('dates every check by its calendar day and carries the last figures of an app forward', () => {
    const earlier = daysAgo(3);
    const history = portfolioHistory(
      [
        app([row('fresh', 10, [[0, 1]])]),
        app([row('stale', 10, [[0, null]], earlier)], earlier),
      ],
      7,
    );

    expect(history.points).toEqual([
      { date: '2026-07-10', visibility: 0, top10: 0, climbed: 0, fell: 0 },
      { date: '2026-07-13', visibility: 50, top10: 1, climbed: 0, fell: 0 },
    ]);
  });

  it('counts a move only on the day the app was checked', () => {
    const earlier = daysAgo(2);
    const history = portfolioHistory(
      [
        app([
          row('fresh', 10, [
            [0, 1],
            [1, 1],
            [2, 1],
          ]),
        ]),
        app(
          [
            row(
              'stale',
              10,
              [
                [0, 4],
                [1, 9],
              ],
              earlier,
            ),
          ],
          earlier,
        ),
      ],
      7,
    );

    expect(history.points.map(({ date, climbed }) => [date, climbed])).toEqual([
      ['2026-07-10', 0],
      ['2026-07-11', 1],
      ['2026-07-12', 0],
      ['2026-07-13', 0],
    ]);
    expect(history.points.at(-1)?.top10).toBe(2);
  });

  it('compares a stale app across its own range', () => {
    const earlier = daysAgo(3);
    const history = portfolioHistory(
      [
        app(
          [
            row(
              'stale',
              10,
              [
                [0, 4],
                [7, 9],
              ],
              earlier,
            ),
          ],
          earlier,
        ),
        app([row('fresh', 10, [[0, 1]])]),
      ],
      7,
    );

    expect(history.change.compared).toBe(true);
    expect(history.change.movement.up).toBe(1);
    expect(history.change.movers.up.map((mover) => mover.text)).toEqual([
      'stale',
    ]);
  });

  it('blends the apps checked on a day by the popularity of their keywords', () => {
    const history = portfolioHistory(
      [app([row('a', 10, [[0, 1]])]), app([row('b', 5, [[0, 3]])])],
      7,
    );

    expect(history.points[0].visibility).toBeCloseTo(83.3, 1);
  });

  it('compares the newest day with the day the range began', () => {
    const history = portfolioHistory(
      [
        app([
          row('climbs', 10, [
            [0, 2],
            [7, 12],
          ]),
          row('falls', 10, [
            [0, 30],
            [7, 8],
          ]),
          row('enters', 10, [
            [0, 40],
            [7, null],
          ]),
        ]),
        app([row('new app', 10, [[0, 1]])]),
      ],
      7,
    );

    expect(history.change.movement).toEqual({
      up: 2,
      down: 1,
      entered: 1,
      lost: 0,
    });
    expect(history.change.appsMoved).toBe(1);
    expect(history.change.top10Delta).toBe(0);
    expect(history.change.visibilityDelta).not.toBeNull();
    expect(history.change.movers.up.map((mover) => mover.text)).toEqual([
      'enters',
      'climbs',
    ]);
    expect(history.change.movers.down.map((mover) => mover.text)).toEqual([
      'falls',
    ]);
  });

  it('answers no change when no app was checked the day the range began', () => {
    const history = portfolioHistory(
      [
        app([
          row('a', 10, [
            [0, 1],
            [3, 5],
          ]),
        ]),
      ],
      30,
    );

    expect(history.change).toEqual(QUIET);
  });

  it('compares with the neighbouring day when the exact day was not checked', () => {
    const history = portfolioHistory(
      [
        app([
          row('a', 10, [
            [0, 2],
            [6, 9],
          ]),
          row('b', 10, [
            [0, 30],
            [6, 4],
          ]),
        ]),
      ],
      7,
    );

    expect(history.change.compared).toBe(true);
    expect(history.change.movement).toMatchObject({ up: 1, down: 1 });
    expect(history.change.top10Delta).toBe(-1);
    expect(history.change.visibilityDelta).not.toBeNull();
  });

  it('reads the popularity scored on or before each day', () => {
    const scored = row('a', 10, [
      [0, 1],
      [1, 1],
    ]);
    scored.keyword.metrics = [
      { traffic: 40, difficulty: 10, date: daysAgo(0) },
      { traffic: 10, difficulty: 10, date: daysAgo(5) },
    ];
    const other = row('b', 10, [
      [0, null],
      [1, null],
    ]);

    const history = portfolioHistory([app([scored, other])], 7);

    expect(history.points[0].visibility).toBeCloseTo(50, 1);
    expect(history.points[1].visibility).toBeCloseTo(80, 1);
  });

  it('keeps the eight largest movers of each direction', () => {
    const rows = Array.from({ length: 10 }, (_, index) =>
      row(`k${index}`, 10, [
        [0, 1],
        [7, 20 + index],
      ]),
    );

    const history = portfolioHistory([app(rows)], 7);

    expect(history.change.movers.up).toHaveLength(8);
    expect(history.change.movement.up).toBe(10);
  });
});
