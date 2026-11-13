import { describe, expect, it } from "vitest";
import type { RankingPoint, RankingSeriesItem } from "@asobeast/shared";
import { lastCheckedDay, seriesStats } from "./series-stats";

const point = (
  day: number,
  position: number | null,
  depth = 200,
): RankingPoint => ({
  date: `2026-11-${String(day).padStart(2, "0")}`,
  position,
  depth,
});

const series = (points: RankingPoint[]): RankingSeriesItem => ({
  keywordId: "kw-1",
  text: "focus timer",
  store: "APP_STORE",
  country: "us",
  points,
});

describe("seriesStats", () => {
  it("reads the newest check, the move across the range, the best and the mean", () => {
    const stats = seriesStats(
      series([point(5, 10), point(6, 9), point(8, 7), point(12, 3)]),
      "2026-11-12",
    );

    expect(stats.latest).toEqual(point(12, 3));
    expect(stats.change).toEqual({ kind: "moved", places: -7 });
    expect(stats.best).toBe(3);
    expect(stats.average).toBe(7);
    expect(stats.staleSince).toBeNull();
  });

  it("orders the points by day before it compares them", () => {
    const stats = seriesStats(series([point(12, 12), point(5, 6)]), null);

    expect(stats.latest).toEqual(point(12, 12));
    expect(stats.change).toEqual({ kind: "moved", places: 6 });
  });

  it("names a keyword that started ranking inside the range", () => {
    expect(
      seriesStats(series([point(5, null), point(12, 40)]), null).change,
    ).toEqual({ kind: "entered" });
  });

  it("names a keyword that dropped out of the results", () => {
    const stats = seriesStats(series([point(5, 14), point(12, null)]), null);

    expect(stats.change).toEqual({ kind: "lost" });
    expect(stats.latest).toEqual(point(12, null));
    expect(stats.best).toBe(14);
  });

  it("keeps a keyword never found without a best or a mean", () => {
    const stats = seriesStats(
      series([point(5, null, 100), point(12, null)]),
      null,
    );

    expect(stats.change).toEqual({ kind: "unranked" });
    expect(stats.best).toBeNull();
    expect(stats.average).toBeNull();
  });

  it("has no change to report from a single check", () => {
    expect(seriesStats(series([point(12, 4)]), null).change).toBeNull();
  });

  it("has nothing to report without a check", () => {
    const stats = seriesStats(series([]), "2026-11-12");

    expect(stats.latest).toBeNull();
    expect(stats.change).toBeNull();
    expect(stats.staleSince).toBeNull();
  });

  it("marks a keyword whose checks stopped before the newest day", () => {
    expect(
      seriesStats(series([point(5, 7), point(9, 7)]), "2026-11-12").staleSince,
    ).toBe("2026-11-09");
  });
});

describe("lastCheckedDay", () => {
  it("is the newest day any series was checked", () => {
    expect(
      lastCheckedDay([
        series([point(5, 7), point(9, 7)]),
        series([point(12, 3)]),
      ]),
    ).toBe("2026-11-12");
  });

  it("is null without a check", () => {
    expect(lastCheckedDay([series([])])).toBeNull();
  });
});
