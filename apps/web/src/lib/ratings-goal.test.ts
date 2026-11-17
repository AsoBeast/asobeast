import { describe, expect, it } from "vitest";
import {
  defaultTargetTenths,
  displayedTenths,
  fiveStarRatingsToReach,
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
});

describe("defaultTargetTenths", () => {
  it("is the next tenth above the rounded average", () => {
    expect(defaultTargetTenths(4.3)).toBe(44);
    expect(defaultTargetTenths(4.36)).toBe(45);
  });

  it("stops at 5.0", () => {
    expect(defaultTargetTenths(5)).toBe(50);
    expect(defaultTargetTenths(4.96)).toBe(50);
  });
});

describe("parseTargetTenths", () => {
  it("reads a target from 0.1 to 5.0", () => {
    expect(parseTargetTenths("4.5")).toBe(45);
    expect(parseTargetTenths("5")).toBe(50);
    expect(parseTargetTenths("0.1")).toBe(1);
  });

  it("refuses an empty, unreadable or out of range target", () => {
    expect(parseTargetTenths("")).toBeNull();
    expect(parseTargetTenths("  ")).toBeNull();
    expect(parseTargetTenths("abc")).toBeNull();
    expect(parseTargetTenths("0")).toBeNull();
    expect(parseTargetTenths("5.1")).toBeNull();
  });
});

describe("parseGoalDays", () => {
  it("reads a whole number of days", () => {
    expect(parseGoalDays("30")).toBe(30);
    expect(parseGoalDays("365")).toBe(365);
  });

  it("refuses an empty, fractional or out of range count", () => {
    expect(parseGoalDays("")).toBeNull();
    expect(parseGoalDays("1.5")).toBeNull();
    expect(parseGoalDays("0")).toBeNull();
    expect(parseGoalDays("366")).toBeNull();
  });
});

describe("fiveStarRatingsToReach", () => {
  it("counts the five star ratings that lift 4.3 to a shown 4.5", () => {
    expect(fiveStarRatingsToReach(4.3, 1000, 45, 30)).toEqual({
      kind: "needed",
      ratings: 273,
      perDay: 10,
    });
  });

  it("targets the rounding boundary, not the target itself", () => {
    const result = fiveStarRatingsToReach(4.3, 1000, 45, 30);
    const reached = (4.3 * 1000 + 5 * 273) / 1273;
    const missed = (4.3 * 1000 + 5 * 272) / 1272;
    expect(reached).toBeGreaterThanOrEqual(4.45);
    expect(missed).toBeLessThan(4.45);
    expect(result).toMatchObject({ ratings: 273 });
  });

  it("is already reached when the average rounds to the target", () => {
    expect(fiveStarRatingsToReach(4.45, 500, 45, 30)).toEqual({
      kind: "reached",
    });
    expect(fiveStarRatingsToReach(4.449, 500, 45, 30)).not.toEqual({
      kind: "reached",
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
      perDay: 1,
    });
  });

  it("needs one rating when there are no ratings yet", () => {
    expect(fiveStarRatingsToReach(0, 0, 45, 30)).toEqual({
      kind: "needed",
      ratings: 1,
      perDay: 1,
    });
  });

  it("stays finite at a target of 5.0", () => {
    expect(fiveStarRatingsToReach(4.9, 1000, 50, 30)).toEqual({
      kind: "needed",
      ratings: 1000,
      perDay: 34,
    });
  });

  it("rounds the daily pace up and never to zero", () => {
    expect(fiveStarRatingsToReach(4.3, 10, 45, 365)).toMatchObject({
      perDay: 1,
    });
  });
});
