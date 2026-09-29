import type { ActionTrend } from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import { actionItem } from "./action-test-item";
import { trendChartData } from "./action-trend-chart";

const trend = (overrides: Partial<ActionTrend> = {}): ActionTrend => ({
  metric: "position",
  direction: "lower_is_better",
  depth: 200,
  points: [
    { date: "2026-07-19", checked: true, value: null },
    { date: "2026-07-20", checked: true, value: 18 },
    { date: "2026-07-21", checked: false, value: null },
    { date: "2026-07-22", checked: true, value: 11 },
    { date: "2026-07-23", checked: true, value: 12 },
  ],
  ...overrides,
});

const done = actionItem({
  status: "DONE",
  firstSeenAt: "2026-07-20T03:00:00.000Z",
  closedAt: "2026-07-22T09:00:00.000Z",
});

describe("trendChartData", () => {
  it("labels and reverses a position trend", () => {
    const data = trendChartData(trend(), done);

    expect(data.metricLabel).toBe("Position");
    expect(data.reversed).toBe(true);
    expect(data.domain).toEqual([1, 200]);
  });

  it("uses a fixed scale for scores and the rating", () => {
    const higher = { direction: "higher_is_better" } as const;

    expect(
      trendChartData(trend({ ...higher, metric: "visibility" }), done),
    ).toMatchObject({
      metricLabel: "Visibility",
      reversed: false,
      domain: [0, 100],
    });
    expect(
      trendChartData(trend({ ...higher, metric: "audit" }), done).domain,
    ).toEqual([0, 100]);
    expect(
      trendChartData(trend({ ...higher, metric: "rating" }), done).domain,
    ).toEqual([1, 5]);
    expect(
      trendChartData(trend({ metric: "updateAge", depth: null }), done).domain,
    ).toEqual(["auto", "auto"]);
  });

  it("marks the opening and the close inside the range", () => {
    expect(trendChartData(trend(), done).markers).toEqual([
      { date: "2026-07-20", label: "Opened" },
      { date: "2026-07-22", label: "Done" },
    ]);
  });

  it("leaves out markers outside the range and a close that is not done", () => {
    const early = actionItem({ firstSeenAt: "2026-06-01T00:00:00.000Z" });

    expect(trendChartData(trend(), early).markers).toEqual([]);
  });

  it("summarizes a position trend, unranked days included", () => {
    expect(trendChartData(trend(), done).summary).toBe(
      "Position went from >200 to #12 over 5 days; best #11, worst >200.",
    );
  });

  it("counts every checked day, a not found day included", () => {
    expect(trendChartData(trend(), done).plotted).toBe(4);
  });

  it("plots only checked days so a missed check does not break the line", () => {
    expect(trendChartData(trend(), done).rows).toEqual([
      { date: "2026-07-19", value: null, notFound: 200 },
      { date: "2026-07-20", value: 18, notFound: null },
      { date: "2026-07-22", value: 11, notFound: null },
      { date: "2026-07-23", value: 12, notFound: null },
    ]);
  });

  it("fits the position scale to the ranks when every check found the app", () => {
    const ranked = trend({
      points: [
        { date: "2026-07-20", checked: true, value: 20 },
        { date: "2026-07-22", checked: true, value: 18 },
      ],
    });
    const top = trend({
      points: [{ date: "2026-07-20", checked: true, value: 2 }],
    });

    expect(trendChartData(ranked, done).domain).toEqual([1, 20]);
    expect(trendChartData(top, done).domain).toEqual([1, 10]);
  });

  it("moves a marker on an unchecked day to the next check", () => {
    const closedOnGap = actionItem({
      status: "DONE",
      firstSeenAt: "2026-07-20T03:00:00.000Z",
      closedAt: "2026-07-21T09:00:00.000Z",
    });

    expect(trendChartData(trend(), closedOnGap).markers).toEqual([
      { date: "2026-07-20", label: "Opened" },
      { date: "2026-07-22", label: "Done" },
    ]);
  });
});
