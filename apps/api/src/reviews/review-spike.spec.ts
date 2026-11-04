import { addUtcDays } from '@asobeast/shared';
import {
  judgedDays,
  judgeSpike,
  medianOf,
  spikeThreshold,
  type DayCount,
} from './review-spike';

const DAY = '2026-11-02';

const history = (
  perDay: (back: number) => number,
  days = 28,
): Map<string, DayCount> =>
  new Map(
    Array.from({ length: days }, (_, index) => [
      addUtcDays(DAY, -(index + 1)),
      { count: perDay(index), low: 0 },
    ]),
  );

const judge = (
  counts: Map<string, DayCount>,
  count: number,
  insertedOnDay = count,
  oldestDay: string | null = addUtcDays(DAY, -40),
) =>
  judgeSpike({
    day: DAY,
    counts: new Map([...counts, [DAY, { count, low: 2 }]]),
    insertedOnDay,
    oldestDay,
  });

describe('medianOf', () => {
  it.each([
    [[3, 1, 2], 2],
    [[1, 2, 2, 1], 1.5],
    [[], 0],
  ])('answers %j as %p', (values, median) => {
    expect(medianOf(values)).toBe(median);
  });
});

describe('spikeThreshold', () => {
  it.each([
    [0, 5],
    [1, 5],
    [2, 6],
    [4, 12],
  ])('puts median %p at %p', (median, threshold) => {
    expect(spikeThreshold(median)).toBe(threshold);
  });
});

describe('judgeSpike', () => {
  const quiet = history((back) => back % 2);
  const steady = history(() => 4);

  it('needs more than five reviews on a quiet app', () => {
    expect(judge(quiet, 5)).toBeNull();
    expect(judge(quiet, 6)).toMatchObject({ count: 6, threshold: 5 });
  });

  it('needs more than three times the median on a steady app', () => {
    expect(judge(steady, 12)).toBeNull();
    expect(judge(steady, 13)).toMatchObject({ median: 4, threshold: 12 });
  });

  it.each([
    [13, 0, false],
    [13, 13, true],
    [13, 1, true],
    [20, 2, false],
  ])(
    'judges %p reviews with %p inserted now as a spike: %p',
    (count, inserted, spiked) => {
      expect(judge(steady, count, inserted) !== null).toBe(spiked);
    },
  );

  it('judges nothing with fewer than seven days of history', () => {
    expect(judge(steady, 30, 30, addUtcDays(DAY, -5))).toBeNull();
    expect(judge(steady, 30, 30, null)).toBeNull();
  });

  it('judges a week of history over that week', () => {
    expect(judge(steady, 13, 13, addUtcDays(DAY, -7))).toMatchObject({
      median: 4,
      threshold: 12,
    });
  });

  it('counts a missing day as none and leaves days before the oldest out', () => {
    const sparse = history((back) => (back < 10 ? 3 : 0), 10);

    expect(judge(sparse, 10, 10, addUtcDays(DAY, -10))).toMatchObject({
      median: 3,
      threshold: 9,
    });
    expect(judge(new Map(), 6, 6)).toMatchObject({ median: 0 });
  });

  it('answers the day, its count, median, threshold and low reviews', () => {
    expect(judge(quiet, 6)).toEqual({
      day: DAY,
      count: 6,
      median: 0.5,
      threshold: 5,
      low: 2,
    });
  });
});

describe('judgedDays', () => {
  it('keeps today and yesterday once each, oldest first', () => {
    const now = new Date('2026-11-03T05:00:00.000Z');

    expect(
      judgedDays(
        [
          new Date('2026-11-03T01:00:00.000Z'),
          new Date('2026-11-02T23:00:00.000Z'),
          new Date('2026-11-03T02:00:00.000Z'),
          new Date('2026-11-01T23:59:59.000Z'),
          undefined,
        ],
        now,
      ),
    ).toEqual(['2026-11-02', '2026-11-03']);
  });
});
