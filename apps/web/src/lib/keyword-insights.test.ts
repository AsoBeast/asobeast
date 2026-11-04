import { describe, expect, it } from "vitest";
import type { TrackedKeywordItem } from "@asobeast/shared";
import {
  BEATABLE_MIN_POPULARITY,
  DROPPING_MIN_STREAK,
  INSIGHT_LABELS,
  insightDetail,
  insightsCsv,
  insightsOf,
  MAX_SHOWN_INSIGHTS,
  PAGE_ONE_CLOSE_MAX_POSITION,
  PAGE_ONE_CLOSE_MIN_POSITION,
  shownInsights,
  type KeywordInsight,
} from "./keyword-insights";

const TODAY = "2026-11-03";

function keyword(fields: Partial<TrackedKeywordItem> = {}): TrackedKeywordItem {
  return {
    keywordId: "kw-1",
    text: "focus timer",
    country: "us",
    source: "MANUAL",
    active: true,
    latestPosition: null,
    latestDepth: null,
    latestCheckedOn: null,
    previousPosition: null,
    positionDelta1d: null,
    positionDelta7d: null,
    traffic: null,
    difficulty: null,
    volume: null,
    relevance: null,
    opportunity: null,
    bucket: null,
    scoredAt: null,
    scoreProvenance: null,
    serpVolatility7d: null,
    ...fields,
  };
}

const ranked = (latestPosition: number, latestCheckedOn = TODAY) =>
  keyword({ latestPosition, latestDepth: 200, latestCheckedOn });

const has = (row: TrackedKeywordItem, insight: KeywordInsight) =>
  insightsOf(row, TODAY).includes(insight);

const everything = keyword({
  dropStreak: 3,
  latestPosition: 12,
  latestDepth: 200,
  latestCheckedOn: TODAY,
  volume: 45,
  difficulty: 1.2,
  relevance: 80,
  uncovered: true,
});

describe("the insight constants", () => {
  it("names the thresholds the rules use", () => {
    expect(BEATABLE_MIN_POPULARITY).toBe(20);
    expect(PAGE_ONE_CLOSE_MIN_POSITION).toBe(11);
    expect(PAGE_ONE_CLOSE_MAX_POSITION).toBe(13);
    expect(DROPPING_MIN_STREAK).toBe(3);
    expect(MAX_SHOWN_INSIGHTS).toBe(2);
  });

  it("words every insight", () => {
    expect(INSIGHT_LABELS).toEqual({
      dropping: "Dropping",
      pageOneClose: "Page 1 close",
      beatable: "Beatable",
      notInListing: "Not in listing",
    });
  });
});

describe("dropping", () => {
  it.each<[number | null | undefined, boolean]>([
    [2, false],
    [3, true],
    [4, true],
    [null, false],
    [undefined, false],
  ])("a drop streak of %s answers %s", (dropStreak, expected) => {
    expect(has(keyword({ dropStreak }), "dropping")).toBe(expected);
  });
});

describe("page 1 close", () => {
  it.each([
    [10, false],
    [11, true],
    [13, true],
    [14, false],
  ])("position %s answers %s", (position, expected) => {
    expect(has(ranked(position), "pageOneClose")).toBe(expected);
  });

  it("needs a ranked position", () => {
    expect(
      has(
        keyword({
          latestPosition: null,
          latestDepth: 200,
          latestCheckedOn: TODAY,
        }),
        "pageOneClose",
      ),
    ).toBe(false);
  });

  it("accepts a check from yesterday and refuses an older one", () => {
    expect(has(ranked(12, "2026-11-02"), "pageOneClose")).toBe(true);
    expect(has(ranked(12, "2026-11-01"), "pageOneClose")).toBe(false);
  });

  it("refuses a keyword never checked", () => {
    expect(
      has(
        keyword({
          latestPosition: 12,
          latestDepth: null,
          latestCheckedOn: TODAY,
        }),
        "pageOneClose",
      ),
    ).toBe(false);
  });
});

describe("beatable", () => {
  it.each([
    [19, false],
    [20, true],
  ])("popularity %s with difficulty 5 answers %s", (volume, expected) => {
    expect(has(keyword({ volume, difficulty: 0.5 }), "beatable")).toBe(
      expected,
    );
  });

  it("refuses a difficulty equal to the popularity", () => {
    expect(has(keyword({ volume: 40, difficulty: 4 }), "beatable")).toBe(false);
  });

  it("accepts a difficulty below the popularity", () => {
    expect(has(keyword({ volume: 40, difficulty: 3.9 }), "beatable")).toBe(
      true,
    );
  });

  it("compares the numbers the columns show", () => {
    expect(has(keyword({ volume: 19.6, difficulty: 0.5 }), "beatable")).toBe(
      true,
    );
  });

  it("needs both scores", () => {
    expect(has(keyword({ volume: 40, difficulty: null }), "beatable")).toBe(
      false,
    );
    expect(has(keyword({ volume: null, difficulty: 1 }), "beatable")).toBe(
      false,
    );
  });

  it.each([
    ["floor", false],
    ["absent", false],
    ["listed", true],
  ] as const)("an Apple %s answer answers %s", (state, expected) => {
    const row = keyword({
      volume: 40,
      difficulty: 1,
      scoreSignals: {
        suggestReach: "hit",
        suggestPrefixLength: 2,
        suggestPosition: 1,
        serpRelevance: 0.5,
        medianRatingCount: 100,
        flags: [],
        officialPopularity: 40,
        officialPopularityState: state,
        estimatedTraffic: 4,
      },
    });
    expect(has(row, "beatable")).toBe(expected);
  });
});

describe("not in listing", () => {
  it.each([
    [59, true, false],
    [60, true, true],
    [80, true, true],
    [80, false, false],
    [80, undefined, false],
    [null, true, false],
  ])(
    "relevance %s with uncovered %s answers %s",
    (relevance, uncovered, expected) => {
      expect(has(keyword({ relevance, uncovered }), "notInListing")).toBe(
        expected,
      );
    },
  );
});

describe("insightsOf", () => {
  it("answers every insight in priority order", () => {
    expect(insightsOf(everything, TODAY)).toEqual([
      "dropping",
      "pageOneClose",
      "beatable",
      "notInListing",
    ]);
  });

  it("answers nothing for a paused keyword", () => {
    expect(insightsOf({ ...everything, active: false }, TODAY)).toEqual([]);
  });

  it("shows the first two", () => {
    expect(shownInsights(insightsOf(everything, TODAY))).toEqual([
      "dropping",
      "pageOneClose",
    ]);
  });
});

describe("insightDetail", () => {
  it("explains each insight in a sentence", () => {
    expect(insightDetail(everything, "dropping")).toBe(
      "Fell on 3 checks in a row",
    );
    expect(insightDetail(ranked(12), "pageOneClose")).toBe(
      "2 places from the top 10",
    );
    expect(insightDetail(ranked(11), "pageOneClose")).toBe(
      "1 place from the top 10",
    );
    expect(
      insightDetail(keyword({ volume: 45, difficulty: 1.2 }), "beatable"),
    ).toBe("Difficulty 12 is below popularity 45");
    expect(insightDetail(everything, "notInListing")).toBe(
      "Relevant, and no field of your listing holds it",
    );
  });
});

describe("insightsCsv", () => {
  it("joins every applicable label", () => {
    expect(insightsCsv(everything, TODAY)).toBe(
      "Dropping; Page 1 close; Beatable; Not in listing",
    );
  });

  it("writes an empty cell without an insight", () => {
    expect(insightsCsv(keyword(), TODAY)).toBe("");
  });
});
