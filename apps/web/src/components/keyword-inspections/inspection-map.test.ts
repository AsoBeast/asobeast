import { describe, expect, it } from "vitest";
import type { KeywordInspectionSummary } from "@asobeast/shared";
import {
  drawOrder,
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

  it("skips a label that would cover another dot", () => {
    const points = inspectionPoints(
      [point("alpha label", 10, 50, 90), point("b", 20, 50, 10)],
      US,
      THRESHOLDS,
    );
    expect([...labelledKeywords(points, null)]).toEqual(["b"]);
  });

  it("anchors a label at the right edge to the left of its dot", () => {
    const blocked = inspectionPoints(
      [point("end label", 90, 50, 90), point("b", 80, 50, 10)],
      US,
      THRESHOLDS,
    );
    const clear = inspectionPoints(
      [point("end label", 90, 50, 90), point("b", 95, 50, 10)],
      US,
      THRESHOLDS,
    );
    expect(labelledKeywords(blocked, null).has("end label")).toBe(false);
    expect([...labelledKeywords(clear, null)].sort()).toEqual([
      "b",
      "end label",
    ]);
  });

  it("labels only the better of two points at the same spot", () => {
    const points = inspectionPoints(
      [point("better", 50, 50, 80), point("worse", 50, 50, 20)],
      US,
      THRESHOLDS,
    );
    expect([...labelledKeywords(points, null)]).toEqual(["better"]);
  });

  it("labels nothing on an empty map", () => {
    expect(labelledKeywords([], null).size).toBe(0);
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

describe("drawOrder", () => {
  it("draws earlier runs first so a new run lands on top without moving the rest", () => {
    const points = inspectionPoints(
      [
        summary({
          id: "c",
          keywordId: "c",
          completedAt: "2026-11-05T12:00:00.000Z",
        }),
        summary({
          id: "b",
          keywordId: "b",
          completedAt: "2026-11-05T10:00:00.000Z",
        }),
        summary({
          id: "a",
          keywordId: "a",
          completedAt: "2026-11-05T10:00:00.000Z",
        }),
      ],
      US,
      THRESHOLDS,
    );
    expect(drawOrder(points).map((point) => point.keywordId)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("keeps an empty map empty", () => {
    expect(drawOrder([])).toEqual([]);
    expect(inspectionPoints([], US, THRESHOLDS)).toEqual([]);
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

  it("matches a suggestion the way the store keyword was saved", () => {
    const items = [summary({ id: "todo", keyword: "to do list" })];
    expect(suggestionState("To-Do List", items, US)).toMatchObject({
      kind: "done",
      id: "todo",
    });
  });
});

describe("nextHops", () => {
  it("drops the inspected keyword itself", () => {
    expect(
      nextHops("habit tracker", ["Habit Tracker", "habit tracker app"]),
    ).toEqual(["habit tracker app"]);
  });

  it("drops punctuation variants of the keyword and of each other", () => {
    expect(
      nextHops("to do list", [
        "To-Do List",
        "to do list app",
        "to-do list app",
        "  ",
      ]),
    ).toEqual(["to do list app"]);
  });
});
