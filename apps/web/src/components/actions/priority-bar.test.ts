import { describe, expect, it } from "vitest";
import { prioritySegments } from "./priority-bar";

describe("prioritySegments", () => {
  it("orders segments by priority and shares the whole bar", () => {
    const segments = prioritySegments({
      critical: 1,
      high: 4,
      medium: 4,
      low: 2,
    });

    expect(segments.map((segment) => segment.priority)).toEqual([
      "critical",
      "high",
      "medium",
      "low",
    ]);
    expect(segments.map((segment) => segment.count)).toEqual([1, 4, 4, 2]);
    expect(
      segments.reduce((total, segment) => total + segment.share, 0),
    ).toBeCloseTo(1);
  });

  it("leaves out a priority with nothing open", () => {
    const segments = prioritySegments({
      critical: 0,
      high: 3,
      medium: 0,
      low: 1,
    });

    expect(segments).toEqual([
      { priority: "high", count: 3, share: 0.75 },
      { priority: "low", count: 1, share: 0.25 },
    ]);
  });

  it("returns no segment when nothing is open", () => {
    expect(
      prioritySegments({ critical: 0, high: 0, medium: 0, low: 0 }),
    ).toEqual([]);
  });
});
