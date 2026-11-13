import { describe, expect, it } from "vitest";
import type {
  PortfolioHistory,
  PortfolioHistoryPoint,
  WorkspaceRunStatus,
} from "@asobeast/shared";
import { divergingTrend } from "@/components/charts/diverging-trend";
import { windowDays } from "@/components/charts/trend-axis";
import { historyTrend, movementPairs, unfinishedSince } from "./history-trend";

const day = (offset: number): string =>
  new Date(Date.UTC(2026, 10, 6) - offset * 86_400_000)
    .toISOString()
    .slice(0, 10);

const point = (
  daysAgo: number,
  visibility: number,
  rest: Partial<PortfolioHistoryPoint> = {},
): PortfolioHistoryPoint => ({
  date: day(daysAgo),
  visibility,
  top10: 0,
  climbed: 0,
  fell: 0,
  ...rest,
});

const history = (
  points: PortfolioHistoryPoint[],
  previous: PortfolioHistoryPoint[] = [],
): PortfolioHistory => ({
  days: 7,
  points,
  previous,
  change: {
    compared: false,
    visibilityDelta: null,
    top10Delta: null,
    movement: { up: 0, down: 0, entered: 0, lost: 0 },
    appsMoved: 0,
    movers: { up: [], down: [] },
  },
});

const run = (
  state: WorkspaceRunStatus["state"],
  startedAt: string | null,
): WorkspaceRunStatus => ({
  state,
  startedAt,
  lastCaptureAt: null,
  tracked: 11,
  captured: 9,
  stores: [],
});

describe("historyTrend", () => {
  it("lays the range out day by day and pairs each day with the period before", () => {
    const trend = historyTrend(
      history([point(1, 60), point(0, 61)], [point(8, 50), point(7, 52)]),
      "visibility",
      null,
    );

    expect(trend.rows.map((row) => row.date)).toEqual(windowDays(day(0), 7));
    expect(trend.rows.slice(-2)).toEqual([
      { date: day(1), value: 60, pending: null, previous: 50 },
      { date: day(0), value: 61, pending: null, previous: 52 },
    ]);
    expect(trend.rows[0]).toEqual({
      date: day(6),
      value: null,
      pending: null,
      previous: null,
    });
    expect(trend.compared).toBe(true);
    expect(trend.checked).toBe(2);
  });

  it("reads the count of keywords in the top 10 when asked for it", () => {
    const trend = historyTrend(
      history([point(1, 60, { top10: 4 }), point(0, 61, { top10: 6 })]),
      "top10",
      null,
    );

    expect(trend.rows.slice(-2).map((row) => row.value)).toEqual([4, 6]);
    expect(trend.compared).toBe(false);
  });

  it("answers an empty trend before anything was recorded", () => {
    const trend = historyTrend(history([]), "visibility", day(0));

    expect(trend.rows).toEqual([]);
    expect(trend.checked).toBe(0);
    expect(trend.pendingDay).toBeNull();
  });

  it("hands the newest day to the pending segment while the run is unfinished", () => {
    const trend = historyTrend(
      history([point(2, 58), point(1, 60), point(0, 61)]),
      "visibility",
      day(0),
    );

    expect(trend.pendingDay).toBe(day(0));
    expect(trend.rows.slice(-3).map((row) => row.value)).toEqual([
      58,
      60,
      null,
    ]);
    expect(trend.rows.slice(-3).map((row) => row.pending)).toEqual([
      null,
      60,
      61,
    ]);
  });

  it("dashes a day checked after midnight of a run that started the evening before", () => {
    const trend = historyTrend(
      history([point(1, 60), point(0, 61)]),
      "visibility",
      day(1),
    );

    expect(trend.pendingDay).toBe(day(0));
  });

  it("starts the dashed segment at the last checked day across a gap", () => {
    const trend = historyTrend(
      history([point(3, 58), point(0, 61)]),
      "visibility",
      day(0),
    );

    expect(trend.rows.slice(-4).map((row) => row.pending)).toEqual([
      58,
      null,
      null,
      61,
    ]);
  });

  it("keeps the line whole when the unfinished day has no point yet", () => {
    const trend = historyTrend(
      history([point(2, 58), point(1, 60)]),
      "visibility",
      day(0),
    );

    expect(trend.pendingDay).toBeNull();
    expect(trend.rows.every((row) => row.pending === null)).toBe(true);
  });
});

describe("divergingTrend", () => {
  it("draws fallers below zero on an axis that mirrors the climbers", () => {
    const trend = divergingTrend(
      movementPairs(
        history([
          point(1, 60, { climbed: 3, fell: 1 }),
          point(0, 61, { climbed: 0, fell: 4 }),
        ]),
      ),
      7,
    );

    expect(trend.rows.slice(-2)).toEqual([
      { date: day(1), up: 3, down: -1, checked: true },
      { date: day(0), up: 0, down: -4, checked: true },
    ]);
    expect(trend.rows[0]).toEqual({
      date: day(6),
      up: 0,
      down: 0,
      checked: false,
    });
    expect(trend.domain).toEqual([-4, 4]);
    expect(trend.valueTicks).toEqual([-4, -3, -2, -1, 0, 1, 2, 3, 4]);
    expect(trend.checked).toBe(2);
  });

  it("mirrors a busy day on nine ticks at most", () => {
    const trend = divergingTrend([{ date: day(0), up: 640, down: 2900 }], 7);

    expect(trend.domain).toEqual([-3000, 3000]);
    expect(trend.valueTicks).toEqual([
      -3000, -2000, -1000, 0, 1000, 2000, 3000,
    ]);
  });

  it("answers no rows before anything was recorded", () => {
    expect(divergingTrend([], 30).rows).toEqual([]);
  });

  it("counts only the days the caller calls active", () => {
    const quiet = [
      { date: day(1), up: 0, down: 0 },
      { date: day(0), up: 2, down: 0 },
    ];

    const trend = divergingTrend(quiet, 7, 1);

    expect(trend.checked).toBe(1);
    expect(trend.rows.slice(-2).every((row) => row.checked)).toBe(true);
  });
});

describe("unfinishedSince", () => {
  it("is the UTC day a running or delayed run started", () => {
    expect(unfinishedSince(run("running", "2026-11-06T03:00:04.000Z"))).toBe(
      "2026-11-06",
    );
    expect(unfinishedSince(run("delayed", "2026-11-05T23:30:00.000Z"))).toBe(
      "2026-11-05",
    );
  });

  it("is nothing once the run is complete or never started", () => {
    expect(
      unfinishedSince(run("complete", "2026-11-06T03:00:04.000Z")),
    ).toBeNull();
    expect(unfinishedSince(run("idle", null))).toBeNull();
    expect(unfinishedSince(run("running", null))).toBeNull();
  });
});
