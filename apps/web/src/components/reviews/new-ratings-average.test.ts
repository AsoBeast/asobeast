import { describe, expect, it } from "vitest";
import type { RatingsPoint } from "@asobeast/shared";
import { dayBefore } from "@/lib/utc-day";
import {
  newRatingsAverage,
  newRatingsAverageSeries,
} from "./new-ratings-average";

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

  it("leaves out a stretch where only the average moves", () => {
    const growing = grown(START, 10, 40, 4.7);
    const after = lastListing(growing).date;
    const edited = [4.0, 4.1, 4.2].map((average, index) =>
      point(dayBefore(after, -(index + 1)), 1000, average),
    );
    const answer = newRatingsAverage([...growing, ...edited]);

    expect(answer?.average).toBeCloseTo(4.7, 6);
    expect(answer?.added).toBe(400);
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

  it("breaks the line for a week where the count drops", () => {
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
    const byDate = new Map(series.map((each) => [each.date, each.average]));
    const gap = Array.from({ length: 7 }, (_, day) =>
      byDate.get(dayBefore("2026-10-17", -day)),
    );

    expect(byDate.get("2026-10-16")).toBeCloseTo(4.6, 6);
    expect(gap).toEqual(Array(7).fill(null));
    expect(byDate.get("2026-10-24")).toBeCloseTo(4.6, 6);
    for (const each of series) {
      if (each.average !== null) expect(each.average).toBeCloseTo(4.6, 6);
    }
  });

  it("bridges days the store reported no count", () => {
    const points = grown(START, 20, 40, 4.7).map((each, index) =>
      index >= 9 && index <= 11 ? { ...each, ratingCount: null } : each,
    );
    const byDate = new Map(
      newRatingsAverageSeries(points).map((each) => [each.date, each.average]),
    );

    expect(byDate.get("2026-10-14")).toBeCloseTo(4.7, 6);
    expect(byDate.get("2026-10-16")).toBeCloseTo(4.7, 6);
  });
});
