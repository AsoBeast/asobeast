import { describe, expect, it } from "vitest";
import {
  defaultTargetTenths,
  displayedTenths,
  fiveStarRatingsToReach,
  goalPace,
  parseGoalDays,
  parseTargetTenths,
} from "./ratings-goal";

describe("displayedTenths", () => {
  it("rounds the way the store shows one decimal", () => {
    expect(displayedTenths(4.3)).toBe(43);
    expect(displayedTenths(4.34)).toBe(43);
    expect(displayedTenths(4.35)).toBe(44);
    expect(displayedTenths(4.449)).toBe(44);
    expect(displayedTenths(4.45)).toBe(45);
  });

  it("rounds a half that floating point lands a hair under", () => {
    expect(displayedTenths(4.1 + 0.05)).toBe(42);
    expect(displayedTenths(4.6 + 0.05)).toBe(47);
  });
});

describe("defaultTargetTenths", () => {
  it("is the next tenth above the rounded average", () => {
    expect(defaultTargetTenths(4.3, 100)).toBe(44);
    expect(defaultTargetTenths(4.36, 100)).toBe(45);
  });

  it("stops at 5.0", () => {
    expect(defaultTargetTenths(5, 100)).toBe(50);
    expect(defaultTargetTenths(4.96, 100)).toBe(50);
  });

  it("is 5.0 when there are no ratings yet", () => {
    expect(defaultTargetTenths(0, 0)).toBe(50);
  });
});

describe("parseTargetTenths", () => {
  it("reads a target from 0.1 to 5.0", () => {
    expect(parseTargetTenths("4.5")).toBe(45);
    expect(parseTargetTenths("5")).toBe(50);
    expect(parseTargetTenths("0.1")).toBe(1);
    expect(parseTargetTenths(".5")).toBe(5);
    expect(parseTargetTenths(" 4.5 ")).toBe(45);
  });

  it("reads trailing zeros as the same tenth", () => {
    expect(parseTargetTenths("5.00")).toBe(50);
    expect(parseTargetTenths("4.50")).toBe(45);
    expect(parseTargetTenths("4.0")).toBe(40);
  });

  it("refuses an empty, unreadable or out of range target", () => {
    expect(parseTargetTenths("")).toBeNull();
    expect(parseTargetTenths("  ")).toBeNull();
    expect(parseTargetTenths("abc")).toBeNull();
    expect(parseTargetTenths("0")).toBeNull();
    expect(parseTargetTenths("5.1")).toBeNull();
    expect(parseTargetTenths("-4.5")).toBeNull();
  });

  it("refuses more than one decimal instead of rounding it", () => {
    expect(parseTargetTenths("4.55")).toBeNull();
    expect(parseTargetTenths("5.04")).toBeNull();
    expect(parseTargetTenths("0.05")).toBeNull();
  });

  it("refuses notations a person does not type as a rating", () => {
    expect(parseTargetTenths("1e0")).toBeNull();
    expect(parseTargetTenths("0x2")).toBeNull();
    expect(parseTargetTenths("4.")).toBeNull();
  });
});

describe("parseGoalDays", () => {
  it("reads a whole number of days from 1 to 365", () => {
    expect(parseGoalDays("1")).toBe(1);
    expect(parseGoalDays("30")).toBe(30);
    expect(parseGoalDays("365")).toBe(365);
  });

  it("refuses an empty, fractional, out of range or unusual count", () => {
    expect(parseGoalDays("")).toBeNull();
    expect(parseGoalDays("1.5")).toBeNull();
    expect(parseGoalDays("0")).toBeNull();
    expect(parseGoalDays("366")).toBeNull();
    expect(parseGoalDays("3e2")).toBeNull();
    expect(parseGoalDays("0x1e")).toBeNull();
  });
});

describe("goalPace", () => {
  it("asks for whole ratings a day, rounded up, when there are more ratings than days", () => {
    expect(goalPace(273, 30)).toEqual({ kind: "daily", ratings: 10 });
    expect(goalPace(30, 30)).toEqual({ kind: "daily", ratings: 1 });
  });

  it("spaces the ratings out when fewer are needed than there are days", () => {
    expect(goalPace(3, 30)).toEqual({ kind: "every", days: 10 });
    expect(goalPace(4, 30)).toEqual({ kind: "every", days: 7 });
    expect(goalPace(1, 365)).toEqual({ kind: "every", days: 365 });
  });

  it("says one a day while a rating every two days would fall short", () => {
    expect(goalPace(16, 30)).toEqual({ kind: "daily", ratings: 1 });
    expect(goalPace(15, 30)).toEqual({ kind: "every", days: 2 });
  });
});

describe("fiveStarRatingsToReach", () => {
  it("counts the five-star ratings that lift 4.3 to a shown 4.5", () => {
    expect(fiveStarRatingsToReach(4.3, 1000, 45, 30)).toEqual({
      kind: "needed",
      ratings: 273,
      pace: { kind: "daily", ratings: 10 },
    });
  });

  it("targets the rounding boundary, not the target itself", () => {
    const reached = (4.3 * 1000 + 5 * 273) / 1273;
    const missed = (4.3 * 1000 + 5 * 272) / 1272;
    expect(displayedTenths(reached)).toBe(45);
    expect(displayedTenths(missed)).toBe(44);
  });

  it("is already reached when the average rounds to the target", () => {
    expect(fiveStarRatingsToReach(4.45, 500, 45, 30)).toEqual({
      kind: "reached",
    });
    expect(fiveStarRatingsToReach(4.449, 500, 45, 30)).toMatchObject({
      kind: "needed",
    });
  });

  it("is reached when the average is above the target", () => {
    expect(fiveStarRatingsToReach(4.8, 500, 45, 30)).toEqual({
      kind: "reached",
    });
  });

  it("needs few ratings when the average sits a hair under the boundary", () => {
    expect(fiveStarRatingsToReach(4.4499, 100000, 45, 30)).toEqual({
      kind: "needed",
      ratings: 19,
      pace: { kind: "daily", ratings: 1 },
    });
  });

  it("counts exactly at a boundary for a large number of ratings", () => {
    expect(fiveStarRatingsToReach(4.8, 100000, 50, 30)).toMatchObject({
      ratings: 300000,
    });
    expect(fiveStarRatingsToReach(4.3, 1000, 45, 30)).toMatchObject({
      ratings: 273,
    });
  });

  it("never asks for zero ratings while the shown average is short", () => {
    expect(fiveStarRatingsToReach(4.4499999997, 1, 45, 30)).toMatchObject({
      kind: "needed",
      ratings: 1,
    });
  });

  it("spaces a small goal over the days instead of asking one a day", () => {
    expect(fiveStarRatingsToReach(4.3, 10, 45, 30)).toEqual({
      kind: "needed",
      ratings: 3,
      pace: { kind: "every", days: 10 },
    });
  });

  it("is the first rating when there are no ratings yet", () => {
    expect(fiveStarRatingsToReach(0, 0, 50, 30)).toEqual({ kind: "first" });
    expect(fiveStarRatingsToReach(0, 0, 1, 30)).toEqual({ kind: "first" });
  });

  it("stays finite at a target of 5.0", () => {
    expect(fiveStarRatingsToReach(4.9, 1000, 50, 30)).toEqual({
      kind: "needed",
      ratings: 1000,
      pace: { kind: "daily", ratings: 34 },
    });
  });

  it("matches the smallest count a brute force finds", () => {
    const misses: string[] = [];
    for (let count = 1; count <= 120; count += 7) {
      for (let sum = count; sum <= 5 * count; sum += 3) {
        for (let target = 1; target <= 50; target += 1) {
          let smallest = 0;
          while (
            displayedTenths((sum + 5 * smallest) / (count + smallest)) < target
          ) {
            smallest += 1;
          }
          const goal = fiveStarRatingsToReach(sum / count, count, target, 30);
          const ratings = goal.kind === "needed" ? goal.ratings : 0;
          if (ratings !== smallest) misses.push(`${sum}/${count}→${target}`);
        }
      }
    }
    expect(misses).toEqual([]);
  });
});
