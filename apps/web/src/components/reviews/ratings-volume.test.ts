import { describe, expect, it } from "vitest";
import type { RatingsPoint } from "@asobeast/shared";
import { dayBefore } from "@/lib/utc-day";
import {
  latestRatingCount,
  newRatings,
  newRatingsAverage,
  newRatingsAverageSeries,
  ratingsAdded,
  ratingsGrowth,
} from "./ratings-volume";

const point = (
  date: string,
  ratingCount: number | null,
  ratingAvg: number | null = 4.5,
): RatingsPoint => ({
  date,
  ratingAvg,
  ratingCount,
});

interface Listing {
  date: string;
  count: number;
  average: number;
}

function grown(
  start: Listing,
  days: number,
  perDay: number,
  mean: number,
): RatingsPoint[] {
  const points = [point(start.date, start.count, start.average)];
  let { count, average } = start;
  for (let day = 1; day <= days; day += 1) {
    const next = count + perDay;
    average = (average * count + mean * perDay) / next;
    count = next;
    points.push(point(dayBefore(start.date, -day), count, average));
  }
  return points;
}

const lastListing = (points: readonly RatingsPoint[]): Listing => {
  const last = points[points.length - 1];
  return {
    date: last.date,
    count: last.ratingCount ?? 0,
    average: last.ratingAvg ?? 0,
  };
};

const roundedLikeTheStore = (points: readonly RatingsPoint[]) =>
  points.map((each) => ({
    ...each,
    ratingAvg:
      each.ratingAvg === null ? null : Number(each.ratingAvg.toFixed(5)),
  }));

const START = { date: "2026-10-01", count: 2000, average: 4.3 };

const HISTORY = [
  point("2026-11-01", 100),
  point("2026-11-02", 130),
  point("2026-11-03", null),
  point("2026-11-04", 125),
  point("2026-11-09", 200),
  point("2026-11-11", 260),
];

describe("newRatings", () => {
  it("draws each read as the ratings gained since the read before", () => {
    expect(newRatings(HISTORY)).toEqual([
      { date: "2026-11-02", added: 30 },
      { date: "2026-11-04", added: 0 },
      { date: "2026-11-09", added: 75 },
      { date: "2026-11-11", added: 60 },
    ]);
  });

  it("draws nothing from fewer than two counted reads", () => {
    expect(newRatings([point("2026-11-01", 100)])).toEqual([]);
    expect(newRatings([point("2026-11-01", null)])).toEqual([]);
  });
});

describe("ratingsAdded", () => {
  it("counts from the read at the start of the window, or just before it", () => {
    expect(ratingsAdded(HISTORY, 7)).toBe(135);
    expect(ratingsAdded(HISTORY, 2)).toBe(60);
  });

  it("answers null without a read near the start of the window", () => {
    expect(ratingsAdded(HISTORY, 30)).toBeNull();
    expect(ratingsAdded([], 7)).toBeNull();
  });
});

describe("ratingsGrowth", () => {
  it("counts the ratings gained since the first counted read", () => {
    expect(ratingsGrowth(HISTORY)).toEqual({ added: 160, since: "2026-11-01" });
  });

  it("answers null from fewer than two counted reads", () => {
    expect(ratingsGrowth([point("2026-11-01", 100)])).toBeNull();
  });
});

describe("a count the store lowered", () => {
  const RESET = [point("2026-11-01", 5000), point("2026-11-02", 1000)];

  it("draws no bar below zero and reports the net change as it is", () => {
    expect(newRatings(RESET)).toEqual([{ date: "2026-11-02", added: 0 }]);
    expect(ratingsGrowth(RESET)).toEqual({ added: -4000, since: "2026-11-01" });
    expect(ratingsAdded(RESET, 1)).toBe(-4000);
  });
});

describe("latestRatingCount", () => {
  it("reads the newest counted point", () => {
    expect(latestRatingCount([...HISTORY, point("2026-11-12", null)])).toBe(
      260,
    );
    expect(latestRatingCount([])).toBeNull();
  });
});

describe("newRatingsAverage", () => {
  it("averages the ratings added", () => {
    const answer = newRatingsAverage(grown(START, 30, 40, 4.7));

    expect(answer?.average).toBeCloseTo(4.7, 6);
    expect(answer?.added).toBe(1200);
    expect(answer?.span).toBe(30);
  });

  it("answers nothing with fewer than five new ratings", () => {
    expect(newRatingsAverage(grown(START, 4, 1, 4.7))).toBeNull();
    expect(newRatingsAverage(grown(START, 5, 1, 4.7))?.added).toBe(5);
  });

  it("answers nothing when rounding could move it by more than a twentieth of a star", () => {
    const big = { date: "2026-10-01", count: 200_000, average: 4.3 };

    expect(
      newRatingsAverage(roundedLikeTheStore(grown(big, 20, 1, 4.7))),
    ).toBeNull();
    expect(
      newRatingsAverage(roundedLikeTheStore(grown(big, 20, 3, 4.7)))?.average,
    ).toBeCloseTo(4.7, 1);
  });

  it("breaks the series where the count drops", () => {
    const before = grown(
      { date: "2026-10-01", count: 4200, average: 4.4 },
      20,
      40,
      4.6,
    );
    const resetDay = dayBefore(lastListing(before).date, -1);
    const after = grown(
      { date: resetDay, count: 1000, average: 4.5 },
      10,
      40,
      4.6,
    );
    const answer = newRatingsAverage([...before, ...after]);

    expect(lastListing(before).count).toBe(5000);
    expect(answer?.average).toBeCloseTo(4.6, 6);
    expect(answer?.added).toBe(1200);
  });

  it("skips points without a count or an average", () => {
    const points = grown(START, 10, 40, 4.7);
    const gaps = points.map((each, index) =>
      index === 3
        ? { ...each, ratingCount: null }
        : index === 6
          ? { ...each, ratingAvg: null }
          : each,
    );

    expect(newRatingsAverage(gaps)?.average).toBeCloseTo(4.7, 6);
    expect(newRatingsAverage(gaps)?.added).toBe(400);
  });

  it("adds nothing for days the count repeats", () => {
    const growing = grown(START, 5, 40, 4.7);
    const quiet = grown(lastListing(growing), 5, 0, 4.7).slice(1);
    const answer = newRatingsAverage([...growing, ...quiet]);

    expect(answer?.average).toBeCloseTo(4.7, 6);
    expect(answer?.added).toBe(200);
    expect(answer?.span).toBe(10);
  });

  it("answers nothing outside one to five stars", () => {
    expect(newRatingsAverage(grown(START, 2, 40, 5.6))).toBeNull();
    expect(newRatingsAverage(grown(START, 2, 40, 0.6))).toBeNull();
  });

  it("answers nothing for one point", () => {
    expect(newRatingsAverage(grown(START, 0, 40, 4.7))).toBeNull();
    expect(newRatingsAverage([])).toBeNull();
  });
});

describe("newRatingsAverageSeries", () => {
  it("starts on the first day with a full week behind it", () => {
    const series = newRatingsAverageSeries(grown(START, 30, 40, 4.7));

    expect(series).toHaveLength(31);
    expect(series.slice(0, 7).map((each) => each.average)).toEqual(
      Array(7).fill(null),
    );
    expect(series[7].date).toBe("2026-10-08");
    for (const each of series.slice(7)) {
      expect(each.average).toBeCloseTo(4.7, 6);
    }
  });

  it("leaves a day without enough new ratings empty", () => {
    const growing = grown(START, 10, 40, 4.7);
    const quiet = grown(lastListing(growing), 10, 0, 4.7).slice(1);
    const resumed = grown(lastListing(quiet), 10, 40, 4.7).slice(1);
    const series = newRatingsAverageSeries([...growing, ...quiet, ...resumed]);
    const byDate = new Map(series.map((each) => [each.date, each.average]));

    expect(byDate.get(lastListing(growing).date)).toBeCloseTo(4.7, 6);
    expect(byDate.get(lastListing(quiet).date)).toBeNull();
    expect(byDate.get(lastListing(resumed).date)).toBeCloseTo(4.7, 6);
  });

  it("breaks at a reset", () => {
    const before = grown(
      { date: "2026-10-01", count: 4400, average: 4.4 },
      15,
      40,
      4.6,
    );
    const after = grown(
      {
        date: dayBefore(lastListing(before).date, -1),
        count: 1000,
        average: 4.5,
      },
      15,
      40,
      4.6,
    );
    const series = newRatingsAverageSeries([...before, ...after]);
    const values = series.flatMap((each) =>
      each.average === null ? [] : [each.average],
    );

    expect(values).toHaveLength(series.length - 7);
    for (const value of values) {
      expect(value).toBeCloseTo(4.6, 6);
    }
  });
});
