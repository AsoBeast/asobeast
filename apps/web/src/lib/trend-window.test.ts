import { describe, expect, it } from "vitest";
import {
  seriesByKeyword,
  trendChecks,
  trendDelta,
  trendFrame,
  trendLabel,
  trendPeriod,
  trendRange,
  windowDelta,
} from "./trend-window";

const on = (day: number, position: number | null) => ({
  date: `2026-10-${String(day).padStart(2, "0")}`,
  position,
});
const point = (day: number, position: number | null) => ({
  ...on(day, position),
  depth: 200,
});

describe("trend window", () => {
  it("words the header and the period after the window", () => {
    expect(trendLabel("7d")).toBe("Last 7 days");
    expect(trendLabel("30d")).toBe("Last 30 days");
    expect(trendPeriod("30d")).toBe("over 30 days");
  });

  it("asks for the 30 days ending today", () => {
    expect(trendRange("30d", "2026-11-30")).toEqual({
      from: "2026-11-01",
      to: "2026-11-30",
    });
    expect(trendRange("30d", "2026-03-01")).toEqual({
      from: "2026-01-31",
      to: "2026-03-01",
    });
  });

  it("ends the 30 day line on today and the 7 day one on the newest check", () => {
    expect(trendFrame("30d", "2026-11-30")).toEqual({
      days: 30,
      end: "2026-11-30",
    });
    expect(trendFrame("7d", "2026-11-30")).toEqual({ days: 7 });
  });

  it("measures the move from the first ranked check to the last", () => {
    expect(windowDelta([on(1, null), on(2, 20), on(30, 8)])).toBe(-12);
    expect(windowDelta([on(1, 5), on(30, 14)])).toBe(9);
  });

  it.each([
    ["no checks", []],
    ["a latest check that missed", [on(1, 5), on(30, null)]],
    ["a single ranked check", [on(1, null), on(30, 5)]],
    ["no ranked check", [on(1, null), on(2, null)]],
  ])("has no delta for %s", (_case, checks) => {
    expect(windowDelta(checks)).toBeNull();
  });

  it("reads the 7 day figures from the list and the 30 day ones from the series", () => {
    const keyword = {
      keywordId: "kw-1",
      positionDelta7d: -2,
      recentPositions: [on(30, 9), on(31, 7)],
    };
    const series = seriesByKeyword([
      { keywordId: "kw-1", points: [point(2, 30), point(31, 10)] },
    ]);

    expect(trendChecks(keyword, "7d", series)).toBe(keyword.recentPositions);
    expect(trendDelta(keyword, "7d", series)).toBe(-2);
    expect(trendChecks(keyword, "30d", series)).toEqual([
      point(2, 30),
      point(31, 10),
    ]);
    expect(trendDelta(keyword, "30d", series)).toBe(-20);
  });

  it("has no 30 day data before the series arrives or for a keyword it lacks", () => {
    const keyword = { keywordId: "kw-1", positionDelta7d: -2 };

    expect(trendChecks(keyword, "30d", undefined)).toBeUndefined();
    expect(trendChecks(keyword, "30d", seriesByKeyword([]))).toBeUndefined();
    expect(trendDelta(keyword, "30d", undefined)).toBeNull();
  });
});
