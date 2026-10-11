import { describe, expect, it } from "vitest";
import type { KeywordBreakdownStanding } from "@asobeast/shared";
import { insightText, standingLines } from "./keyword-insights";

const standing = (
  over: Partial<KeywordBreakdownStanding> = {},
): KeywordBreakdownStanding => ({
  above: 0,
  competitors: 0,
  aboveWithStrongerPlacement: 0,
  missingTerms: [],
  changedDaysAgo: null,
  ...over,
});

describe("insightText", () => {
  it("compares where the keyword sits in both listings", () => {
    expect(
      insightText({ rule: "placement", theirs: "title", yours: "subtitle" }),
    ).toBe("Has the keyword in its title; yours is in the subtitle.");
    expect(
      insightText({ rule: "placement", theirs: "subtitle", yours: "split" }),
    ).toBe(
      "Has the keyword in its subtitle; your words are spread over fields.",
    );
    expect(
      insightText({ rule: "placement", theirs: "split", yours: "partial" }),
    ).toBe(
      "Has every word, spread over its fields; you have only some of the words.",
    );
    expect(
      insightText({ rule: "placement", theirs: "partial", yours: "none" }),
    ).toBe("Has some of the words; your listing does not have it.");
  });

  it("names the ratings gap", () => {
    expect(insightText({ rule: "ratings", theirs: 48000, yours: 1200 })).toBe(
      "No stronger placement than yours, but 48,000 ratings to your 1,200.",
    );
  });

  it("words the cases with nothing visible", () => {
    expect(insightText({ rule: "unchecked", localizations: 7 })).toContain(
      "7 of its language versions could not be checked",
    );
    expect(insightText({ rule: "hidden" })).toContain("keyword field");
    expect(insightText({ rule: "similar" })).toContain("installs");
  });
});

describe("standingLines", () => {
  it("says nothing when there is nothing to compare", () => {
    expect(standingLines(standing())).toEqual([]);
  });

  it("names the words no listing covers", () => {
    expect(standingLines(standing({ missingTerms: ["map", "pin"] }))[0]).toBe(
      "No single listing of yours has “map” and “pin”, so you are not fully eligible for this search.",
    );
  });

  it("counts the competitors above you and those placed stronger", () => {
    expect(
      standingLines(
        standing({ above: 3, competitors: 5, aboveWithStrongerPlacement: 2 }),
      ),
    ).toEqual([
      "3 of 5 competitors rank above you, 2 with the keyword in a stronger place than yours.",
    ]);
    expect(standingLines(standing({ above: 1, competitors: 1 }))).toEqual([
      "1 of 1 competitor ranks above you, none with a stronger placement than yours.",
    ]);
  });

  it("says when you lead every competitor", () => {
    expect(standingLines(standing({ competitors: 4 }))).toEqual([
      "You rank above every tracked competitor on this keyword.",
    ]);
  });

  it("warns that a recent listing change has not settled", () => {
    expect(standingLines(standing({ changedDaysAgo: 1 }))).toEqual([
      "Your listing text changed 1 day ago. Ranks usually settle two to four weeks after a change.",
    ]);
  });
});
