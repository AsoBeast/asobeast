import { describe, expect, it } from "vitest";
import { isTrackedRow, markedParts, occurrences } from "./density-marks";

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

  it("skips the links and addresses the counts leave out", () => {
    const text =
      "Planner help: https://example.com/planner/help, planner@example.com, www.planner-site.org and a planner.";

    expect(textAt(text, "planner")).toEqual(["Planner", "planner"]);
    expect(textAt(text, "help")).toEqual(["help"]);
  });

  it("finds a phrase as often as it overlaps itself", () => {
    expect(textAt("tab tab tab", "tab tab")).toEqual(["tab tab", "tab tab"]);
    expect(textAt("habit #habit habit", "habit habit")).toEqual([
      "habit #habit",
      "habit habit",
    ]);
    expect(textAt("fire 🔥 fire fire", "fire fire")).toEqual([
      "fire 🔥 fire",
      "fire fire",
    ]);
    expect(textAt("タイマータイマータイマー", "タイマータイマー")).toHaveLength(
      2,
    );
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

describe("markedParts", () => {
  it("draws an overlapping run as one mark", () => {
    expect(markedParts("Go tab tab tab now", "tab tab")).toEqual([
      { text: "Go ", marked: false, start: 0 },
      { text: "tab tab tab", marked: true, start: 3 },
      { text: " now", marked: false, start: 14 },
    ]);
  });

  it("keeps separate occurrences apart", () => {
    expect(
      markedParts("plan a, plan", "plan").filter((part) => part.marked),
    ).toEqual([
      { text: "plan", marked: true, start: 0 },
      { text: "plan", marked: true, start: 8 },
    ]);
  });
});
