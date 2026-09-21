import { describe, expect, it } from "vitest";
import type { ScoreSignals } from "@asobeast/shared";
import { difficultySignalLines, trafficSignalLines } from "./score-signals";

function signals(overrides: Partial<ScoreSignals> = {}): ScoreSignals {
  return {
    suggestReach: "hit",
    suggestPrefixLength: 2,
    suggestPosition: 8,
    serpRelevance: 0.9,
    medianRatingCount: 45_000,
    flags: [],
    officialPopularity: null,
    estimatedTraffic: 5.4,
    ...overrides,
  };
}

describe("trafficSignalLines", () => {
  it.each([
    [
      signals(),
      "The store suggests it after 2 typed characters, in position 8.",
    ],
    [
      signals({ suggestPrefixLength: 1, suggestPosition: 1 }),
      "The store suggests it after 1 typed character, in position 1.",
    ],
    [
      signals({
        suggestReach: "listed",
        suggestPrefixLength: null,
        suggestPosition: 3,
      }),
      "The store suggests it only once the whole phrase is typed.",
    ],
    [
      signals({
        suggestReach: "absent",
        suggestPrefixLength: null,
        suggestPosition: null,
      }),
      "The store never suggests this phrase, so volume is capped.",
    ],
    [
      signals({
        suggestReach: "unavailable",
        suggestPrefixLength: null,
        suggestPosition: null,
      }),
      "Suggestions were unavailable, so volume comes from the ranking apps alone.",
    ],
  ])("describes the suggest reach %#", (input, expected) => {
    expect(trafficSignalLines(input)).toEqual([expected]);
  });

  it("names apple's own number first", () => {
    expect(trafficSignalLines(signals({ officialPopularity: 71 }))).toEqual([
      "Apple reports a search popularity of 71 for this term.",
      "The store suggests it after 2 typed characters, in position 8.",
    ]);
  });

  it("says nothing without signals", () => {
    expect(trafficSignalLines(null)).toEqual([]);
  });
});

describe("difficultySignalLines", () => {
  it.each([
    ["brand", "A brand search: one app dominates this page."],
    ["weak_leader", "The top result has fewer than 100 ratings."],
    ["small_serp", "The store returns three results or fewer."],
    [
      "padded",
      "Few results target this phrase; the page is padded with other apps.",
    ],
  ] as const)("explains the %s flag", (flag, expected) => {
    expect(difficultySignalLines(signals({ flags: [flag] }))).toEqual([
      expected,
    ]);
  });

  it("keeps the declared flag order", () => {
    expect(
      difficultySignalLines(signals({ flags: ["padded", "brand"] })),
    ).toEqual([
      "A brand search: one app dominates this page.",
      "Few results target this phrase; the page is padded with other apps.",
    ]);
  });

  it("describes a typical page without flags", () => {
    expect(difficultySignalLines(signals())).toEqual([
      "Typical top ten app: 45,000 ratings.",
    ]);
  });

  it("says nothing without a median or signals", () => {
    expect(difficultySignalLines(signals({ medianRatingCount: null }))).toEqual(
      [],
    );
    expect(difficultySignalLines(null)).toEqual([]);
  });
});
