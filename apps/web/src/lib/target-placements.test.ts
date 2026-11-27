import type { PlacementSuggestion } from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import type { TargetSlots } from "./listing-targets";
import { applyPlacements, applyRefusal } from "./target-placements";

const EMPTY: TargetSlots = Array<null>(10).fill(null);

describe("applyPlacements", () => {
  const verdict = (
    field: PlacementSuggestion["field"],
  ): PlacementSuggestion => ({
    field,
    reason: "strongestReachable",
    popularity: 50,
    difficulty: 30,
    position: null,
  });
  const placements = new Map<string, PlacementSuggestion>([
    ["habit tracker", verdict("title")],
    ["daily goals", verdict("subtitle")],
    ["streaks", verdict("subtitle")],
    ["focus", verdict("keywordField")],
    ["routine planner", verdict("keywordField")],
    ["todoist", verdict("skip")],
  ]);
  const slotsOf = (...texts: (string | null)[]): TargetSlots => [
    ...texts,
    ...Array<null>(10 - texts.length).fill(null),
  ];

  it("moves the title suggestion to slot 1 and the subtitle suggestions to slots 2 and 3", () => {
    expect(
      applyPlacements(
        slotsOf("focus", "streaks", "habit tracker", "daily goals"),
        placements,
      ),
    ).toEqual(slotsOf("habit tracker", "streaks", "daily goals", "focus"));
  });

  it("leaves a role slot empty when no suggestion fills it", () => {
    expect(
      applyPlacements(slotsOf("focus", "daily goals"), placements),
    ).toEqual(slotsOf(null, "daily goals", null, "focus"));
  });

  it("puts every other target from slot 4 on", () => {
    expect(
      applyPlacements(
        slotsOf(
          "unscored",
          "todoist",
          "focus",
          "habit tracker",
          "routine planner",
        ),
        placements,
      ),
    ).toEqual(
      slotsOf(
        "habit tracker",
        null,
        null,
        "focus",
        "routine planner",
        "todoist",
        "unscored",
      ),
    );
  });

  it("leaves empty slots at the end of the extra slots", () => {
    expect(
      applyPlacements(
        slotsOf("habit tracker", null, null, null, null, null, "focus"),
        placements,
      ),
    ).toEqual(slotsOf("habit tracker", null, null, "focus"));
  });

  it("keeps a second title suggestion ahead of the extra slots", () => {
    const twoTitles = new Map(placements).set("calm", verdict("title"));
    expect(
      applyPlacements(slotsOf("focus", "calm", "habit tracker"), twoTitles),
    ).toEqual(slotsOf("calm", null, null, "habit tracker", "focus"));
  });

  it("fills an empty role slot only when the extra slots are full", () => {
    const texts = Array.from({ length: 10 }, (_, index) => `phrase ${index}`);
    const result = applyPlacements(
      ["habit tracker", ...texts.slice(1)],
      placements,
    );
    expect(result).toHaveLength(10);
    expect(result[0]).toBe("habit tracker");
    expect(new Set(result)).toEqual(
      new Set(["habit tracker", ...texts.slice(1)]),
    );
  });

  it("answers the same list when it already matches", () => {
    const slots = slotsOf("habit tracker", "daily goals", "streaks", "focus");
    expect(applyPlacements(slots, placements)).toEqual(slots);
    expect(applyRefusal(slots, placements)).toBe(
      "Your targets already follow the suggestions",
    );
  });

  it("refuses when no target has a suggestion", () => {
    expect(applyRefusal(slotsOf("unscored", "other"), placements)).toBe(
      "No target has a suggestion yet",
    );
    expect(applyRefusal(EMPTY, placements)).toBe(
      "No target has a suggestion yet",
    );
  });

  it("offers to apply when the order differs", () => {
    expect(
      applyRefusal(slotsOf("focus", "habit tracker"), placements),
    ).toBeNull();
  });

  it("never adds a candidate", () => {
    const result = applyPlacements(slotsOf("focus"), placements);
    expect(result.filter((slot) => slot !== null)).toEqual(["focus"]);
  });
});
