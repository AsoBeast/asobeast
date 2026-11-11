import { describe, expect, it } from "vitest";
import { ratedPoints, ratingAxis, ratingChange } from "./rating-trend";

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
  it("leaves a tenth of a star around the plotted ratings", () => {
    const [low, high] = ratingAxis(
      ratedPoints([point("2026-11-10", 4.42), point("2026-11-11", 4.58)]),
    );

    expect(low).toBeCloseTo(4.3);
    expect(high).toBeCloseTo(4.7);
  });

  it("never leaves the scale of a rating", () => {
    const [low, high] = ratingAxis(
      ratedPoints([point("2026-11-10", 0), point("2026-11-11", 5)]),
    );

    expect(low).toBe(0);
    expect(high).toBe(5);
  });
});
