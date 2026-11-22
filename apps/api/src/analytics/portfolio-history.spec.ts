import { RANK_DEPTH, Store, visibility } from '@asobeast/shared';
import { TrackedRow } from './analytics.support';
import {
  HistoryMember,
  ListingChangeStamp,
  portfolioHistory,
} from './portfolio-history';

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
  store: Store = 'APP_STORE',
): HistoryMember => {
  nextApp += 1;
  return { appId: `app_${nextApp}`, store, rows, referenceDate };
};

const stamp = (
  appId: string,
  field: string,
  ago: number,
): ListingChangeStamp => ({
  appId,
  field,
  capturedAt: new Date(daysAgo(ago).getTime() + 9 * 60 * 60 * 1000),
});

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

  it('leaves an app out of the change when its latest check is before the range', () => {
    const earlier = daysAgo(7);
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
        app([
          row('fresh', 10, [
            [0, 2],
            [7, 2],
          ]),
        ]),
      ],
      7,
    );

    expect(history.change.compared).toBe(true);
    expect(history.change.movement).toEqual({
      up: 0,
      down: 0,
      entered: 0,
      lost: 0,
    });
    expect(history.change.appsMoved).toBe(0);
    expect(history.change.movers).toEqual({ up: [], down: [] });
    expect(history.change.visibilityDelta).toBe(0);
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

  it('reads a keyword checked the day before the range began at that check everywhere', () => {
    const partial = portfolioHistory(
      [
        app([
          row('a', 10, [
            [0, 3],
            [7, 4],
          ]),
          row('b', 10, [
            [0, 2],
            [8, 5],
          ]),
        ]),
      ],
      7,
    );
    const whole = portfolioHistory(
      [
        app([
          row('a', 10, [
            [0, 3],
            [7, 4],
          ]),
          row('b', 10, [
            [0, 2],
            [7, 5],
          ]),
        ]),
      ],
      7,
    );

    expect(partial.change.top10Delta).toBe(0);
    expect(partial.change.movement).toEqual(whole.change.movement);
    expect(partial.change.visibilityDelta).toBe(whole.change.visibilityDelta);
  });

  it('weights a keyword checked the day before the range began by the popularity of that check', () => {
    const checked = row('b', 60, [
      [0, 2],
      [8, 5],
    ]);
    const b: TrackedRow = {
      ...checked,
      keyword: {
        ...checked.keyword,
        metrics: [
          { traffic: 60, difficulty: 10, date: daysAgo(7) },
          { traffic: 20, difficulty: 10, date: daysAgo(8) },
        ],
      },
    };

    const history = portfolioHistory(
      [
        app([
          row('a', 10, [
            [0, 3],
            [7, 4],
          ]),
          b,
        ]),
      ],
      7,
    );
    const now = visibility([
      { traffic: 10, position: 3 },
      { traffic: 60, position: 2 },
    ]);
    const then = visibility([
      { traffic: 10, position: 4 },
      { traffic: 20, position: 5 },
    ]);

    expect(history.change.visibilityDelta).toBe(
      Math.round((now - then) * 10) / 10,
    );
  });

  it('never compares a keyword with a check two days from the range start', () => {
    const history = portfolioHistory(
      [
        app([
          row('a', 10, [
            [0, 3],
            [6, 9],
          ]),
          row('b', 10, [
            [0, 2],
            [5, 40],
          ]),
        ]),
      ],
      7,
    );

    expect(history.change.movers.up.map((mover) => mover.text)).toEqual(['a']);
  });

  describe('a daily run still in progress', () => {
    const midRun = () =>
      app([
        row('a', 10, [
          [0, 2],
          [1, 2],
          [7, 2],
        ]),
        row('b', 10, [
          [1, 6],
          [7, 6],
        ]),
        row('c', 10, [
          [1, 8],
          [7, 8],
        ]),
        row('d', 10, [
          [0, 30],
          [1, 30],
          [7, 30],
        ]),
      ]);
    const carried = visibility(
      [2, 6, 8, 30].map((position) => ({ traffic: 10, position })),
    );

    it('counts a keyword still waiting for the newest check at its position of the day before in the tiles', () => {
      const history = portfolioHistory([midRun()], 7);

      expect(history.apps?.[0].change).toMatchObject({
        visibility: carried,
        visibilityDelta: 0,
        top10: 3,
        top10Delta: 0,
      });
      expect(history.stores?.[0].change).toMatchObject({
        top10: 3,
        top10Delta: 0,
      });
      expect(history.change).toMatchObject({
        visibilityDelta: 0,
        top10Delta: 0,
      });
    });
  });

  describe('the figures behind the pooled line', () => {
    const rising = () =>
      app([
        row('climbs', 10, [
          [0, 2],
          [1, 4],
          [7, 12],
        ]),
        row('steady', 10, [
          [0, 30],
          [1, 30],
          [7, 30],
        ]),
      ]);
    const falling = () =>
      app(
        [
          row('falls', 10, [
            [0, 60],
            [1, 9],
            [7, 3],
          ]),
        ],
        TODAY,
        'GOOGLE_PLAY',
      );

    it('splits the keywords of each checked day by rank', () => {
      const history = portfolioHistory([rising(), falling()], 7);

      expect(history.bands).toEqual([
        {
          date: '2026-07-12',
          rank1: 0,
          rank2to3: 0,
          rank4to10: 2,
          rank11to50: 1,
          rank51plus: 0,
          unranked: 0,
        },
        {
          date: '2026-07-13',
          rank1: 0,
          rank2to3: 1,
          rank4to10: 0,
          rank11to50: 1,
          rank51plus: 1,
          unranked: 0,
        },
      ]);
    });

    it('answers each app with its own points and its change over the range', () => {
      const up = rising();
      const down = falling();
      const history = portfolioHistory([up, down], 7);
      const [first, second] = history.apps ?? [];

      expect(first.appId).toBe(up.appId);
      expect(first.points.map(({ date, top10 }) => [date, top10])).toEqual([
        ['2026-07-12', 1],
        ['2026-07-13', 1],
      ]);
      expect(first.change).toMatchObject({
        top10: 1,
        top10Delta: 1,
        movement: { up: 1, down: 0, entered: 0, lost: 0 },
      });
      expect(first.change.visibilityDelta).toBeGreaterThan(0);
      expect(second.appId).toBe(down.appId);
      expect(second.change).toMatchObject({
        top10: 0,
        top10Delta: -1,
        movement: { up: 0, down: 1, entered: 0, lost: 0 },
      });
      expect(second.change.visibilityDelta).toBeLessThan(0);
      expect(second.change.visibility).toBe(
        visibility([{ traffic: 10, position: 60 }]),
      );
    });

    it('counts what each app moved in its last run', () => {
      const history = portfolioHistory([rising(), falling()], 30);

      expect(history.apps?.map((each) => each.lastRun)).toEqual([
        { up: 1, down: 0, entered: 0, lost: 0 },
        { up: 0, down: 1, entered: 0, lost: 0 },
      ]);
      expect(history.lastRun?.compared).toBe(true);
      expect(history.lastRun?.movement).toEqual({
        up: 1,
        down: 1,
        entered: 0,
        lost: 0,
      });
      expect(history.lastRun?.movers.down.map((mover) => mover.text)).toEqual([
        'falls',
      ]);
    });

    it('leaves an app that was not checked on the newest day out of the last run', () => {
      const earlier = daysAgo(2);
      const stale = app(
        [
          row(
            'stale',
            10,
            [
              [0, 5],
              [1, 9],
            ],
            earlier,
          ),
        ],
        earlier,
      );
      const history = portfolioHistory([rising(), stale], 7);

      expect(history.lastRun?.movement.up).toBe(1);
      expect(history.apps?.[1].lastRun).toEqual({
        up: 0,
        down: 0,
        entered: 0,
        lost: 0,
      });
    });

    it('never reads a check of the newest day or of two days ago as yesterday', () => {
      const firstRun = portfolioHistory([app([row('new', 10, [[0, 4]])])], 7);
      const skipped = portfolioHistory(
        [
          app([
            row('skipped', 10, [
              [0, 4],
              [2, 9],
            ]),
          ]),
        ],
        7,
      );

      expect(firstRun.lastRun?.compared).toBe(false);
      expect(skipped.lastRun?.compared).toBe(false);
      expect(skipped.apps?.[0].lastRun).toEqual({
        up: 0,
        down: 0,
        entered: 0,
        lost: 0,
      });
    });

    it('compares only the keywords checked on both the newest day and the day before', () => {
      const history = portfolioHistory(
        [
          app([
            row('checked', 10, [
              [0, 3],
              [1, 8],
            ]),
            row('added today', 10, [[0, 5]]),
            row('skipped', 10, [
              [0, 20],
              [2, 4],
            ]),
            row('missed today', 10, [
              [1, 5],
              [2, 5],
            ]),
          ]),
        ],
        7,
      );

      expect(history.lastRun?.visibilityDelta).toBeGreaterThan(0);
      expect(history.lastRun?.movement).toEqual({
        up: 1,
        down: 0,
        entered: 0,
        lost: 0,
      });
      expect(history.lastRun?.top10Delta).toBe(0);
    });

    it('answers no change for an app without a check when the range began', () => {
      const history = portfolioHistory(
        [rising(), app([row('new', 10, [[0, 4]])])],
        7,
      );

      expect(history.apps?.[1].change).toEqual({
        visibility: visibility([{ traffic: 10, position: 4 }]),
        visibilityDelta: null,
        top10: 1,
        top10Delta: null,
        movement: { up: 0, down: 0, entered: 0, lost: 0 },
      });
    });

    it('pools the apps of each store and leaves out a store without apps', () => {
      const both = portfolioHistory([rising(), rising(), falling()], 7);

      expect(
        both.stores?.map(({ store, apps, change }) => [
          store,
          apps,
          change.top10,
          change.movement.up,
          change.movement.down,
        ]),
      ).toEqual([
        ['APP_STORE', 2, 2, 2, 0],
        ['GOOGLE_PLAY', 1, 0, 0, 1],
      ]);
      expect(
        portfolioHistory([rising()], 7).stores?.map(({ store }) => store),
      ).toEqual(['APP_STORE']);
    });

    it('lists the fields each charted app changed itself per day, in listing order', () => {
      const own = rising();
      const history = portfolioHistory([own], 7, [
        stamp(own.appId, 'subtitle', 2),
        stamp(own.appId, 'title', 2),
        stamp(own.appId, 'title', 2),
        stamp(own.appId, 'featuring', 2),
        stamp(own.appId, 'editorsChoice', 3),
        stamp(own.appId, 'inAppEvents', 3),
        stamp(own.appId, 'screenshots', 0),
        stamp(own.appId, 'title', 7),
        stamp(own.appId, 'ratingCount', 1),
        stamp('app_elsewhere', 'title', 1),
      ]);

      expect(history.listingChanges).toEqual([
        { date: '2026-07-10', appId: own.appId, fields: ['inAppEvents'] },
        { date: '2026-07-11', appId: own.appId, fields: ['title', 'subtitle'] },
        { date: '2026-07-13', appId: own.appId, fields: ['screenshots'] },
      ]);
    });
  });
});
