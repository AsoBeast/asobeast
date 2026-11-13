import { describe, expect, it } from "vitest";
import type { RatingsPoint } from "@asobeast/shared";
import {
  latestRatingCount,
  newRatings,
  ratingsAdded,
  ratingsGrowth,
} from "./ratings-volume";

const point = (date: string, ratingCount: number | null): RatingsPoint => ({
  date,
  ratingAvg: 4.5,
  ratingCount,
});

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

describe("latestRatingCount", () => {
  it("reads the newest counted point", () => {
    expect(latestRatingCount([...HISTORY, point("2026-11-12", null)])).toBe(
      260,
    );
    expect(latestRatingCount([])).toBeNull();
  });
});
