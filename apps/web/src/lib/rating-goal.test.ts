import { describe, expect, it } from "vitest";
import {
  ratingGoalDefaultTarget,
  ratingGoalNeeded,
  RATING_GOAL_DEFAULT_DAYS,
  RATING_GOAL_NOTE_MAX_COUNT,
} from "./rating-goal";

describe("ratingGoalDefaultTarget", () => {
  it("defaults to the next 0.1 above the rounded average", () => {
    expect(ratingGoalDefaultTarget(4.3)).toBe(4.4);
    expect(ratingGoalDefaultTarget(4.31881)).toBe(4.4);
    expect(ratingGoalDefaultTarget(4.94)).toBe(5);
  });

  it("caps the default at 5", () => {
    expect(ratingGoalDefaultTarget(4.95)).toBe(5);
    expect(ratingGoalDefaultTarget(5)).toBe(5);
  });
});

describe("ratingGoalNeeded", () => {
  it("says the average already shows the target at the rounding boundary", () => {
    expect(ratingGoalNeeded(100, 4.45, 4.5)).toEqual({
      kind: "already",
      target: 4.5,
    });
    expect(ratingGoalNeeded(100, 4.5, 4.5)).toEqual({
      kind: "already",
      target: 4.5,
    });
  });

  it("counts the five star ratings needed just below the boundary", () => {
    expect(ratingGoalNeeded(100, 4.44, 4.5)).toEqual({
      kind: "needed",
      needed: 2,
      target: 4.5,
    });
  });

  it("matches the issue example", () => {
    expect(ratingGoalNeeded(1144, 4.3, 4.5)).toEqual({
      kind: "needed",
      needed: 312,
      target: 4.5,
    });
  });

  it("says one rating is enough when nothing is rated", () => {
    expect(ratingGoalNeeded(0, 0, 4.5)).toEqual({
      kind: "needed",
      needed: 1,
      target: 4.5,
    });
  });

  it("returns a whole number", () => {
    expect(ratingGoalNeeded(1, 4.3, 4.5).kind).toBe("needed");
    const needed = (ratingGoalNeeded(1, 4.3, 4.5) as { needed: number }).needed;
    expect(Number.isInteger(needed)).toBe(true);
  });
});

describe("ratings goal constants", () => {
  it("keeps the default days and note threshold", () => {
    expect(RATING_GOAL_DEFAULT_DAYS).toBe(30);
    expect(RATING_GOAL_NOTE_MAX_COUNT).toBe(20);
  });
});
