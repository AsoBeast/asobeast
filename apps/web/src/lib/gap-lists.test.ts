import { describe, expect, it } from "vitest";
import type {
  CompetitorGapCoverage,
  CompetitorGapKeyword,
  CompetitorGaps,
} from "@asobeast/shared";
import { gapCounts, gapEmpty, gapRows } from "./gap-lists";

const row = (keywordId: string, country?: string): CompetitorGapKeyword => ({
  keywordId,
  text: keywordId,
  volume: null,
  difficulty: null,
  opportunity: null,
  yourPosition: null,
  bestCompetitorPosition: 5,
  bestCompetitorId: "comp-1",
  gap: null,
  ...(country ? { country } : {}),
});

const GAPS: CompetitorGaps = {
  theyRankYouDont: [],
  youRankTheyDont: [],
  outranked: [],
  keywordGaps: [row("a", "us"), row("b", "de"), row("c")],
  winnable: [row("a", "us")],
  threats: [row("d", "de")],
  lead: [],
};

const coverage = (
  over: Partial<CompetitorGapCoverage> = {},
): CompetitorGapCoverage => ({
  competitors: 1,
  delisted: 0,
  markets: [
    { country: "de", keywords: 2, compared: 0 },
    { country: "us", keywords: 3, compared: 3 },
  ],
  ...over,
});

const ids = (rows: CompetitorGapKeyword[]) => rows.map((r) => r.keywordId);

describe("gapRows", () => {
  it("answers the list of the tab", () => {
    expect(ids(gapRows(GAPS, "gaps", "", "us"))).toEqual(["a", "b", "c"]);
    expect(ids(gapRows(GAPS, "threats", "", "us"))).toEqual(["d"]);
  });

  it("answers nothing for a list an older api does not send", () => {
    expect(
      gapRows(
        { theyRankYouDont: [], youRankTheyDont: [], outranked: [] },
        "lead",
        "",
        "us",
      ),
    ).toEqual([]);
  });

  it("keeps one market and counts a row without one as home", () => {
    expect(ids(gapRows(GAPS, "gaps", "us", "us"))).toEqual(["a", "c"]);
    expect(ids(gapRows(GAPS, "gaps", "de", "us"))).toEqual(["b"]);
  });
});

describe("gapCounts", () => {
  it("counts every tab of a market", () => {
    expect(gapCounts(GAPS, "de", "us")).toEqual({
      gaps: 1,
      winnable: 0,
      threats: 1,
      lead: 0,
    });
  });
});

describe("gapEmpty", () => {
  it.each([
    ["no coverage", undefined, "", "none"],
    ["no competitor", coverage({ competitors: 0 }), "", "noCompetitors"],
    [
      "every competitor delisted",
      coverage({ competitors: 0, delisted: 2 }),
      "",
      "allDelisted",
    ],
    ["a market never compared", coverage(), "de", "notCompared"],
    ["a market coverage does not list", coverage(), "fr", "notCompared"],
    [
      "every market never compared",
      coverage({ markets: [{ country: "us", keywords: 2, compared: 0 }] }),
      "",
      "notCompared",
    ],
    ["one compared market", coverage(), "", "none"],
    ["a compared market without rows", coverage(), "us", "none"],
  ] as const)("answers %s", (_, given, country, expected) => {
    expect(gapEmpty(given, country)).toBe(expected);
  });
});
