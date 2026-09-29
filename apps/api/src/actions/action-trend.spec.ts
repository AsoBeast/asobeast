import { ACTION_RULES } from '@asobeast/shared';
import {
  ACTION_TREND_LEAD_DAYS,
  ACTION_TREND_MAX_DAYS,
  ACTION_TREND_MIN_DAYS,
  dailyPoints,
  trailingMeanPoints,
  TREND_DIRECTION,
  TREND_METRIC,
  trendWindow,
  updateAgePoints,
} from './action-trend';

const DAY_MS = 86_400_000;
const TODAY = new Date('2026-07-30T00:00:00.000Z');
const day = (offset: number): Date =>
  new Date(TODAY.getTime() - offset * DAY_MS);
const key = (offset: number): string => day(offset).toISOString().slice(0, 10);

describe('trendWindow', () => {
  it('covers at least the minimum days before today', () => {
    expect(trendWindow(day(3), null, TODAY)).toEqual({
      from: day(ACTION_TREND_MIN_DAYS),
      to: TODAY,
    });
  });

  it('leads the first sighting and the close by two weeks', () => {
    expect(trendWindow(day(40), null, TODAY).from).toEqual(
      day(40 + ACTION_TREND_LEAD_DAYS),
    );
    expect(trendWindow(day(10), day(50), TODAY).from).toEqual(
      day(50 + ACTION_TREND_LEAD_DAYS),
    );
  });

  it('never reaches further back than the retention window', () => {
    expect(trendWindow(day(400), null, TODAY).from).toEqual(
      day(ACTION_TREND_MAX_DAYS),
    );
  });
});

describe('dailyPoints', () => {
  it('emits one point per day with unchecked gaps and the last value of a day', () => {
    const points = dailyPoints(
      [
        { date: day(2), value: 14 },
        { date: new Date(day(0).getTime() + 3_600_000), value: 9 },
        { date: day(0), value: 8 },
        { date: day(1), value: null },
      ],
      day(3),
      TODAY,
    );

    expect(points).toEqual([
      { date: key(3), checked: false, value: null },
      { date: key(2), checked: true, value: 14 },
      { date: key(1), checked: true, value: null },
      { date: key(0), checked: true, value: 9 },
    ]);
  });
});

describe('trailingMeanPoints', () => {
  it('averages the reviews of the trailing days, fewer at the start', () => {
    const points = trailingMeanPoints(
      [
        { date: day(3), score: 5 },
        { date: day(1), score: 2 },
        { date: day(1), score: 3 },
      ],
      day(4),
      TODAY,
      2,
    );

    expect(points.map((point) => point.value)).toEqual([null, 5, 5, 2.5, 2.5]);
    expect(points[0].checked).toBe(false);
  });
});

describe('updateAgePoints', () => {
  it('counts whole days since the update and restarts after one', () => {
    const points = updateAgePoints(
      [
        { capturedAt: day(3), storeUpdatedAt: day(10) },
        { capturedAt: day(2), storeUpdatedAt: day(10) },
        { capturedAt: day(1), storeUpdatedAt: day(1) },
        { capturedAt: day(0), storeUpdatedAt: null },
      ],
      day(3),
      TODAY,
    );

    expect(points.map((point) => point.value)).toEqual([7, 8, 0, null]);
    expect(points.at(-1)?.checked).toBe(false);
  });
});

describe('trend metrics', () => {
  it('gives every rule a metric with a direction', () => {
    for (const rule of ACTION_RULES) {
      expect(TREND_DIRECTION[TREND_METRIC[rule]]).toMatch(
        /^(lower|higher)_is_better$/,
      );
    }
    expect(TREND_DIRECTION.position).toBe('lower_is_better');
    expect(TREND_DIRECTION.visibility).toBe('higher_is_better');
  });
});
