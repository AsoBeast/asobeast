import { describe, expect, it } from "vitest";
import { isTrackedRow, occurrences } from "./density-marks";

const textAt = (text: string, row: string): string[] =>
  occurrences(text, row).map(({ start, end }) => text.slice(start, end));

describe("isTrackedRow", () => {
  const tracked = ["focus timer", "mode d'occasion", "集中タイマー"];

  it("marks a row that is a tracked keyword", () => {
    expect(isTrackedRow("focus timer", tracked)).toBe(true);
    expect(isTrackedRow("focus", tracked)).toBe(false);
  });

  it("reads a tracked keyword the way the density splits it", () => {
    expect(isTrackedRow("mode d occasion", tracked)).toBe(true);
  });

  it("matches a spaceless keyword written without spaces", () => {
    expect(isTrackedRow("集中タイマー", tracked)).toBe(true);
    expect(isTrackedRow("集中", tracked)).toBe(false);
  });
});

describe("occurrences", () => {
  it("finds every place a row appears in the text", () => {
    const text = "Focus timer. A focus  timer! Refocus timer";

    expect(occurrences(text, "focus timer")).toEqual([
      { start: 0, end: 11 },
      { start: 15, end: 27 },
    ]);
    expect(textAt(text, "focus timer")).toEqual([
      "Focus timer",
      "focus  timer",
    ]);
  });

  it("reads a row across the marks the density leaves out", () => {
    expect(
      textAt("Mode d'occasion et mode d’occasion", "mode d occasion"),
    ).toEqual(["Mode d'occasion", "mode d’occasion"]);
  });

  it("never marks a phrase across a sentence or a comma", () => {
    const text = "Plan daily. Planner daily planner, planner! Daily planner";

    expect(textAt(text, "daily planner")).toEqual([
      "daily planner",
      "Daily planner",
    ]);
  });

  it("finds a spaceless row by its characters", () => {
    expect(textAt("集中タイマーと集中タイマー", "集中タイマー")).toEqual([
      "集中タイマー",
      "集中タイマー",
    ]);
  });

  it("answers no range for an empty row", () => {
    expect(occurrences("Focus timer", "")).toEqual([]);
    expect(occurrences("Focus timer", "  ")).toEqual([]);
  });

  it("treats the row as text, never as a pattern", () => {
    expect(occurrences("axb a+b", "a+b")).toEqual([{ start: 4, end: 7 }]);
  });
});
