import { describe, expect, it } from "vitest";
import { formatRating } from "@/lib/format";
import {
  isLoneNewAverage,
  ratedPoints,
  ratingAxis,
  ratingChange,
  withNewRatings,
} from "./rating-trend";

const point = (date: string, ratingAvg: number | null) => ({
  date,
  ratingAvg,
  ratingCount: ratingAvg === null ? null : 100,
});

describe("ratingChange", () => {
  it("compares the latest rating with the one a week before", () => {
    const points = [
      point("2026-11-01", 4.5),
      point("2026-11-04", 4.6),
      point("2026-11-11", 4.8),
    ];

    expect(ratingChange(points, 7)).toBeCloseTo(0.2);
  });

  it("uses the last rating captured just before the week began", () => {
    const points = [
      point("2026-11-02", 4.1),
      point("2026-11-08", 4.3),
      point("2026-11-11", 4.4),
    ];

    expect(ratingChange(points, 7)).toBeCloseTo(0.3);
  });

  it("answers nothing when the only earlier rating is much older than a week", () => {
    const points = [
      point("2026-10-20", 4.1),
      point("2026-11-08", 4.3),
      point("2026-11-11", 4.4),
    ];

    expect(ratingChange(points, 7)).toBeNull();
  });

  it("skips days without a rating", () => {
    const points = [
      point("2026-11-03", 4.0),
      point("2026-11-04", null),
      point("2026-11-11", 4.2),
      point("2026-11-12", null),
    ];

    expect(ratingChange(points, 7)).toBeCloseTo(0.2);
  });

  it("answers nothing without a rating old enough to compare", () => {
    expect(ratingChange([], 7)).toBeNull();
    expect(ratingChange([point("2026-11-11", 4.8)], 7)).toBeNull();
    expect(
      ratingChange([point("2026-11-09", 4.7), point("2026-11-11", 4.8)], 7),
    ).toBeNull();
  });
});

describe("ratedPoints", () => {
  it("drops the days that carry no rating", () => {
    expect(
      ratedPoints([point("2026-11-10", null), point("2026-11-11", 4.8)]),
    ).toEqual([{ date: "2026-11-11", ratingAvg: 4.8, ratingCount: 100 }]);
  });
});

describe("ratingAxis", () => {
  const axisOf = (...ratings: number[]) =>
    ratingAxis(
      ratedPoints(
        ratings.map((rating, index) =>
          point(`2026-11-${String(index + 10).padStart(2, "0")}`, rating),
        ),
      ),
    );

  const labelsOf = (ticks: readonly number[]) =>
    ticks.map((tick) => formatRating(tick));

  const onTenths = (ticks: readonly number[]) =>
    ticks.every((tick) => Number.isInteger(tick * 10));

  it("labels a rating that moved less than a third of a star once per tenth", () => {
    const { domain, ticks } = axisOf(4.04, 4.08, 4.11);

    expect(domain).toEqual([3.9, 4.2]);
    expect(labelsOf(ticks)).toEqual(["3.9", "4.0", "4.1", "4.2"]);
  });

  it("leaves a tenth of a star around the plotted ratings", () => {
    const { domain, ticks } = axisOf(4.42, 4.58);

    expect(domain).toEqual([4.3, 4.7]);
    expect(ticks).toEqual([4.3, 4.4, 4.5, 4.6, 4.7]);
  });

  it("never leaves the scale of a rating", () => {
    const { domain, ticks } = axisOf(0, 5);

    expect(domain).toEqual([0, 5]);
    expect(ticks).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it.each([
    ["a flat series", [4.1]],
    ["a span of 0.1", [4.1, 4.2]],
    ["a span of 0.2", [4.0, 4.2]],
    ["a span of 0.3", [4.0, 4.3]],
    ["a span of 0.4", [4.0, 4.4]],
    ["a span of 0.7", [3.9, 4.6]],
    ["a span of 1.5", [3.0, 4.5]],
    ["a series touching 5.0", [4.7, 5]],
  ])("draws distinct labels on tenths for %s", (_, ratings) => {
    const { domain, ticks } = axisOf(...ratings);
    const labels = labelsOf(ticks);

    expect(new Set(labels).size).toBe(labels.length);
    expect(labels).toEqual(ticks.map((tick) => tick.toFixed(1)));
    expect(onTenths(ticks)).toBe(true);
    expect(ticks.length).toBeGreaterThanOrEqual(2);
    expect(ticks.length).toBeLessThanOrEqual(6);
    expect(ticks[0]).toBe(domain[0]);
    expect(ticks.at(-1)).toBe(domain[1]);
    expect(domain[0]).toBeGreaterThanOrEqual(0);
    expect(domain[1]).toBeLessThanOrEqual(5);
    expect(domain[0]).toBeLessThanOrEqual(Math.min(...ratings));
    expect(domain[1]).toBeGreaterThanOrEqual(Math.max(...ratings));
  });

  it("fits the axis to both lines", () => {
    const points = ratedPoints([
      point("2026-11-10", 4.3),
      point("2026-11-11", 4.35),
    ]);

    expect(ratingAxis(points).domain).toEqual([4.2, 4.5]);
    expect(ratingAxis(points, [4.72, null]).domain).toEqual([4.2, 4.8]);
  });

  it("spaces the ticks evenly on a whole step", () => {
    const { ticks } = axisOf(3.0, 4.5);
    const gaps = ticks
      .slice(1)
      .map((tick, index) => Math.round((tick - ticks[index]) * 10));

    expect(new Set(gaps).size).toBe(1);
    expect([1, 2, 5, 10]).toContain(gaps[0]);
  });
});

describe("withNewRatings", () => {
  it("adds the new ratings average to the day it belongs to", () => {
    const points = ratedPoints([
      point("2026-11-10", 4.3),
      point("2026-11-11", 4.35),
      point("2026-11-12", 4.4),
    ]);

    expect(
      withNewRatings(points, [
        { date: "2026-11-11", average: 4.7 },
        { date: "2026-11-12", average: null },
        { date: "2026-11-13", average: 4.8 },
      ]).map((row) => row.newAverage),
    ).toEqual([null, 4.7, null]);
  });
});

describe("isLoneNewAverage", () => {
  it("marks a new ratings average with no value on either side", () => {
    const rows = withNewRatings(
      ratedPoints([
        point("2026-11-10", 4.3),
        point("2026-11-11", 4.3),
        point("2026-11-12", 4.3),
        point("2026-11-13", 4.3),
      ]),
      [
        { date: "2026-11-10", average: 4.7 },
        { date: "2026-11-12", average: 4.6 },
        { date: "2026-11-13", average: 4.6 },
      ],
    );

    expect(rows.map((_, index) => isLoneNewAverage(rows, index))).toEqual([
      true,
      false,
      false,
      false,
    ]);
  });
});
