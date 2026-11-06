import { describe, expect, it } from "vitest";
import type { KeywordInspectionSummary } from "@asobeast/shared";
import {
  inspectionPoints,
  labelledKeywords,
  nextHops,
  pointName,
  suggestionState,
} from "./inspection-map";

const US = { store: "APP_STORE", country: "us" } as const;
const THRESHOLDS = { popularity: 20, difficulty: 25 };

function summary(
  overrides: Partial<KeywordInspectionSummary>,
): KeywordInspectionSummary {
  return {
    id: "i1",
    keywordId: "k1",
    keyword: "habit tracker",
    store: "APP_STORE",
    country: "us",
    status: "DONE",
    requestedAt: "2026-11-05T10:00:00.000Z",
    completedAt: "2026-11-05T10:00:05.000Z",
    volume: 64.6,
    difficulty100: 18.2,
    opportunity: 70.4,
    resultCount: 50,
    ...overrides,
  };
}

describe("inspectionPoints", () => {
  it("keeps the newest completed run of each keyword in the storefront", () => {
    const points = inspectionPoints(
      [
        summary({ id: "new", volume: 66 }),
        summary({ id: "old", volume: 40 }),
        summary({ id: "pending", keywordId: "k2", status: "PENDING" }),
        summary({ id: "gb", keywordId: "k3", country: "gb" }),
        summary({ id: "unscored", keywordId: "k4", volume: null }),
        summary({
          id: "hard",
          keywordId: "k5",
          keyword: "daily planner",
          difficulty100: 80,
        }),
      ],
      US,
      THRESHOLDS,
    );

    expect(points.map((point) => point.id)).toEqual(["new", "hard"]);
    expect(points[0]).toMatchObject({
      popularity: 66,
      difficulty: 18,
      opportunity: 70,
      zone: "quickWins",
    });
    expect(points[1].zone).toBe("worthFighting");
  });
});

describe("labelledKeywords", () => {
  const point = (
    keywordId: string,
    difficulty: number,
    popularity: number,
    opportunity: number,
  ) =>
    summary({
      id: keywordId,
      keywordId,
      keyword: keywordId,
      difficulty100: difficulty,
      volume: popularity,
      opportunity,
    });

  it("labels every point whose label fits and lets the better opportunity win a clash", () => {
    const points = inspectionPoints(
      [
        point("far apart", 10, 90, 40),
        point("clash low", 50, 50, 30),
        point("clash high", 52, 50, 60),
        point("right edge", 90, 20, 10),
      ],
      US,
      THRESHOLDS,
    );

    const labelled = labelledKeywords(points, null);

    expect([...labelled].sort()).toEqual([
      "clash high",
      "far apart",
      "right edge",
    ]);
  });

  it("always labels the selected keyword", () => {
    const points = inspectionPoints(
      [point("clash low", 50, 50, 30), point("clash high", 52, 50, 60)],
      US,
      THRESHOLDS,
    );
    expect(labelledKeywords(points, "clash low").has("clash low")).toBe(true);
  });
});

describe("pointName", () => {
  it("reads the keyword, its scores and its zone", () => {
    const [point] = inspectionPoints([summary({})], US, THRESHOLDS);
    expect(pointName(point)).toBe(
      "habit tracker, popularity 65, difficulty 18, opportunity 70, Quick wins",
    );
  });
});

describe("suggestionState", () => {
  it("prefers a running inspection, then a completed one, in the same storefront", () => {
    const items = [
      summary({ id: "gb", country: "gb", status: "PENDING" }),
      summary({ id: "done" }),
    ];
    expect(suggestionState(" Habit Tracker", items, US)).toEqual({
      kind: "done",
      id: "done",
      popularity: 65,
      difficulty: 18,
    });
    expect(
      suggestionState(
        "habit tracker",
        [summary({ id: "run", status: "PENDING" }), ...items],
        US,
      ),
    ).toEqual({ kind: "running", id: "run" });
    expect(suggestionState("water reminder", items, US)).toEqual({
      kind: "new",
    });
  });
});

describe("nextHops", () => {
  it("drops the inspected keyword itself", () => {
    expect(
      nextHops("habit tracker", ["Habit Tracker", "habit tracker app"]),
    ).toEqual(["habit tracker app"]);
  });
});
