import { CHANGE_IMPACT_WINDOWS, ChangeImpactWindow } from '@asobeast/shared';
import {
  addDays,
  Metric,
  Ranking,
  toDateKey,
  utcToday,
} from '../analytics/analytics.support';
import {
  CHANGE_IMPACT_MAX_CHANGES,
  ChangeDay,
  changeDays,
  IMPACT_BASELINE_MAX_AGE_DAYS,
  IMPACT_WINDOW_TOLERANCE_DAYS,
  ImpactKeyword,
  impactReadPlan,
  measureChangeImpact,
} from './change-impact';

const HOUR_MS = 60 * 60 * 1000;
const TODAY = utcToday();
const CHANGED = addDays(TODAY, -40);

const on = (offset: number): Date => addDays(CHANGED, offset);
const key = (offset: number): string => toDateKey(on(offset));

const rankedAround = (
  anchor: Date,
  positions: Array<[number, number | null]>,
  metrics: Metric[] = [],
): ImpactKeyword => ({
  metrics,
  rankings: positions.map(([offset, position]): Ranking => ({
    date: addDays(anchor, offset),
    position,
    depth: 200,
  })),
});

const ranked = (
  positions: Array<[number, number | null]>,
  metrics: Metric[] = [],
): ImpactKeyword => rankedAround(CHANGED, positions, metrics);

const changeOn = (day: Date): ChangeDay => ({ day, fields: ['title'] });

const itemOf = (
  keywords: ImpactKeyword[],
  changes: ChangeDay[] = [changeOn(CHANGED)],
) => measureChangeImpact({ changes, keywords, today: TODAY }).items[0];

const windowOf = (
  keywords: ImpactKeyword[],
  days: number,
): ChangeImpactWindow => {
  const found = itemOf(keywords).windows.find((entry) => entry.days === days);
  if (!found) throw new Error(`no ${days} day window`);
  return found;
};

const windowAt = (
  keywords: ImpactKeyword[],
  changedOn: Date,
  days: number,
): ChangeImpactWindow | undefined =>
  itemOf(keywords, [changeOn(changedOn)]).windows.find(
    (entry) => entry.days === days,
  );

const metric = (traffic: number, date: Date): Metric => ({
  traffic,
  difficulty: null,
  date,
});

describe('measureChangeImpact', () => {
  describe('the baseline', () => {
    it('takes a capture the maximum age before the change as the baseline', () => {
      const item = itemOf([
        ranked([
          [-IMPACT_BASELINE_MAX_AGE_DAYS, 10],
          [7, 5],
        ]),
      ]);

      expect(item.baselineDate).toBe(key(-3));
      expect(item.windows[0].status).toBe('measured');
    });

    it('ignores an older capture and leaves every window unmeasured', () => {
      const item = itemOf([
        ranked([
          [-IMPACT_BASELINE_MAX_AGE_DAYS - 1, 10],
          [7, 5],
          [14, 5],
          [28, 5],
        ]),
      ]);

      expect(item.baselineDate).toBeNull();
      expect(item.windows.map((entry) => entry.status)).toEqual([
        'unmeasured',
        'unmeasured',
        'unmeasured',
      ]);
    });

    it('takes the latest capture in the baseline and the window range', () => {
      const keywords = [
        ranked([
          [-3, 20],
          [-1, 10],
          [5, 8],
          [7, 4],
        ]),
      ];

      expect(itemOf(keywords).baselineDate).toBe(key(-1));
      expect(windowOf(keywords, 7)).toMatchObject({
        measuredOn: key(7),
        medianPositionChange: -6,
      });
    });
  });

  describe('the measurement date', () => {
    it('measures a window from a capture the tolerance before its target', () => {
      const keywords = [
        ranked([
          [-1, 10],
          [7 - IMPACT_WINDOW_TOLERANCE_DAYS, 6],
        ]),
      ];

      expect(windowOf(keywords, 7)).toMatchObject({
        status: 'measured',
        targetDate: key(7),
        measuredOn: key(5),
      });
    });

    it('leaves a window unmeasured when the capture is one day earlier', () => {
      const keywords = [
        ranked([
          [-1, 10],
          [7 - IMPACT_WINDOW_TOLERANCE_DAYS - 1, 6],
        ]),
      ];

      expect(windowOf(keywords, 7)).toMatchObject({
        status: 'unmeasured',
        targetDate: key(7),
        measuredOn: null,
        movement: null,
      });
    });

    it('measures a window whose target is today', () => {
      const changedOn = addDays(TODAY, -7);
      const keywords = [
        rankedAround(changedOn, [
          [-1, 9],
          [7, 3],
        ]),
      ];

      expect(windowAt(keywords, changedOn, 7)).toMatchObject({
        status: 'measured',
        targetDate: toDateKey(TODAY),
        measuredOn: toDateKey(TODAY),
      });
    });

    it('keeps a window whose target is after today pending', () => {
      const changedOn = addDays(TODAY, -6);
      const keywords = [rankedAround(changedOn, [[-1, 9]])];

      expect(windowAt(keywords, changedOn, 7)).toEqual({
        days: 7,
        status: 'pending',
        targetDate: toDateKey(addDays(TODAY, 1)),
        measuredOn: null,
        movement: null,
        medianPositionChange: null,
        visibilityBefore: null,
        visibilityAfter: null,
        visibilityChange: null,
        overlappingChanges: [],
      });
    });

    it('keeps every window of a change made today pending', () => {
      const item = itemOf([rankedAround(TODAY, [[-1, 9]])], [changeOn(TODAY)]);

      expect(item.baselineDate).toBe(toDateKey(addDays(TODAY, -1)));
      expect(
        item.windows.map((entry) => [entry.status, entry.targetDate]),
      ).toEqual(
        CHANGE_IMPACT_WINDOWS.map((days) => [
          'pending',
          toDateKey(addDays(TODAY, days)),
        ]),
      );
    });

    it('never measures a change made today without a baseline', () => {
      const item = itemOf([rankedAround(TODAY, [[0, 9]])], [changeOn(TODAY)]);

      expect(item.baselineDate).toBeNull();
      expect(item.windows.map((entry) => entry.status)).toEqual([
        'unmeasured',
        'unmeasured',
        'unmeasured',
      ]);
    });

    it('leaves a window unmeasured when no keyword was checked on both days', () => {
      const keywords = [ranked([[-1, 10]]), ranked([[7, 4]])];

      expect(windowOf(keywords, 7)).toMatchObject({
        status: 'unmeasured',
        measuredOn: null,
        movement: null,
      });
    });
  });

  describe('movement', () => {
    it('counts every keyword checked on both days by how it moved', () => {
      const keywords = [
        ranked([
          [-1, 10],
          [7, 4],
        ]),
        ranked([
          [-1, 5],
          [7, 9],
        ]),
        ranked([
          [-1, 7],
          [7, 7],
        ]),
        ranked([
          [-1, null],
          [7, 30],
        ]),
        ranked([
          [-1, 12],
          [7, null],
        ]),
        ranked([
          [-1, null],
          [7, null],
        ]),
        ranked([[7, 2]]),
      ];

      expect(windowOf(keywords, 7).movement).toEqual({
        improved: 1,
        declined: 1,
        unchanged: 1,
        entered: 1,
        exited: 1,
        measured: 6,
      });
    });

    it('averages the two middle moves of an even count', () => {
      const keywords = [
        ranked([
          [-1, 10],
          [7, 4],
        ]),
        ranked([
          [-1, 7],
          [7, 6],
        ]),
        ranked([
          [-1, 5],
          [7, 7],
        ]),
        ranked([
          [-1, 5],
          [7, 9],
        ]),
        ranked([
          [-1, null],
          [7, 30],
        ]),
      ];

      expect(windowOf(keywords, 7).medianPositionChange).toBe(0.5);
    });

    it('has no median when no keyword ranked on both days', () => {
      const keywords = [
        ranked([
          [-1, null],
          [7, 30],
        ]),
      ];

      expect(windowOf(keywords, 7)).toMatchObject({
        status: 'measured',
        medianPositionChange: null,
        movement: { entered: 1, measured: 1 },
      });
    });

    it('weights both visibilities by the popularity at the baseline', () => {
      const keywords = [
        ranked(
          [
            [-1, 10],
            [7, 4],
          ],
          [metric(1, on(3)), metric(8, on(-10))],
        ),
        ranked(
          [
            [-1, 5],
            [7, 9],
          ],
          [metric(9, on(3)), metric(4, on(-10))],
        ),
      ];

      expect(windowOf(keywords, 7)).toMatchObject({
        visibilityBefore: 32.2,
        visibilityAfter: 38.7,
        visibilityChange: 6.5,
      });
    });
  });

  describe('overlap', () => {
    const changes = [on(27), on(9), on(3), CHANGED].map(changeOn);
    const keywords = [
      ranked([
        [-1, 10],
        [26, 4],
      ]),
    ];
    const windowsOfOldest = () =>
      measureChangeImpact({ changes, keywords, today: TODAY }).items[3].windows;

    it('lists later changes up to the measurement date, oldest first', () => {
      expect(windowsOfOldest()[2]).toMatchObject({
        days: 28,
        measuredOn: key(26),
        overlappingChanges: [key(3), key(9)],
      });
    });

    it('lists later changes up to the target of an unmeasured window', () => {
      expect(windowsOfOldest()[0]).toMatchObject({
        days: 7,
        status: 'unmeasured',
        overlappingChanges: [key(3)],
      });
    });
  });

  describe('grouping', () => {
    it('makes one change of every event on one UTC day, fields in listing order', () => {
      expect(
        changeDays([
          {
            field: 'description',
            capturedAt: new Date(on(0).getTime() + HOUR_MS),
          },
          {
            field: 'title',
            capturedAt: new Date(on(0).getTime() + 23 * HOUR_MS),
          },
          {
            field: 'title',
            capturedAt: new Date(on(0).getTime() + 12 * HOUR_MS),
          },
        ]),
      ).toEqual([{ day: on(0), fields: ['title', 'description'] }]);
    });

    it('splits events either side of midnight into two days, newest first', () => {
      expect(
        changeDays([
          { field: 'title', capturedAt: new Date(on(0).getTime() - 1) },
          { field: 'subtitle', capturedAt: on(0) },
        ]),
      ).toEqual([
        { day: on(0), fields: ['subtitle'] },
        { day: on(-1), fields: ['title'] },
      ]);
    });

    it('orders changes newest first', () => {
      expect(
        changeDays([
          { field: 'title', capturedAt: on(0) },
          { field: 'title', capturedAt: on(5) },
          { field: 'title', capturedAt: on(2) },
        ]).map((change) => change.day),
      ).toEqual([on(5), on(2), on(0)]);
    });

    it('measures the newest changes up to the cap and counts them all', () => {
      const changes = Array.from(
        { length: CHANGE_IMPACT_MAX_CHANGES + 1 },
        (_, index) => changeOn(addDays(TODAY, -index - 1)),
      );

      const result = measureChangeImpact({
        changes,
        keywords: [],
        today: TODAY,
      });

      expect(result.totalChanges).toBe(13);
      expect(result.items.map((item) => item.changedOn)).toEqual(
        changes
          .slice(0, CHANGE_IMPACT_MAX_CHANGES)
          .map((change) => toDateKey(change.day)),
      );
    });
  });

  describe('the read plan', () => {
    it('reads the baseline and window candidates up to today', () => {
      expect(impactReadPlan([changeOn(addDays(TODAY, -10))], TODAY)).toEqual({
        rankingDates: [-13, -12, -11, -5, -4, -3].map((offset) =>
          addDays(TODAY, offset),
        ),
        metricsUntil: addDays(TODAY, -11),
      });
    });

    it('reads nothing without a change', () => {
      expect(impactReadPlan([], TODAY)).toEqual({
        rankingDates: [],
        metricsUntil: null,
      });
    });

    it('plans the newest changes up to the cap only', () => {
      const changes = Array.from(
        { length: CHANGE_IMPACT_MAX_CHANGES + 1 },
        (_, index) => changeOn(addDays(TODAY, -10 - 10 * index)),
      );
      const times = impactReadPlan(changes, TODAY).rankingDates.map((date) =>
        date.getTime(),
      );

      expect(times).toContain(addDays(TODAY, -121).getTime());
      expect(times).not.toContain(addDays(TODAY, -131).getTime());
    });
  });
});
