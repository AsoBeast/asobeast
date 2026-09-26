import { describe, expect, it } from "vitest";
import { RANK_DEPTH, type TrackedKeywordItem } from "@asobeast/shared";
import { keywordCsv } from "./keyword-csv";

function keyword(
  text: string,
  latestDepth: number | null = RANK_DEPTH,
): TrackedKeywordItem {
  return {
    keywordId: "kw-1",
    text,
    country: "us",
    source: "MANUAL",
    active: true,
    latestPosition: null,
    latestDepth,
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
  };
}

describe("keywordCsv", () => {
  it("neutralizes a formula-like keyword through the shared escaper", () => {
    expect(keywordCsv([keyword("=cmd|'/c calc'!A1")])).toContain(
      "'=cmd|'/c calc'!A1",
    );
  });

  it("renders a checked but unranked position at the captured depth", () => {
    expect(keywordCsv([keyword("focus timer")])).toContain(
      `focus timer,MANUAL,true,>${RANK_DEPTH},`,
    );
  });

  it("leaves the position empty for a keyword that was never checked", () => {
    expect(keywordCsv([keyword("focus timer", null)])).toContain(
      "focus timer,MANUAL,true,,",
    );
  });

  it("exports a stored difficulty past its scale clamped to 100", () => {
    const row = keywordCsv([{ ...keyword("geography quiz"), difficulty: 48.2 }])
      .split("\r\n")[1]
      .split(",");
    expect(row[8]).toBe("100");
  });

  it("adds the score evidence after the capture time", () => {
    expect(keywordCsv([keyword("focus timer")]).split("\r\n")[0]).toContain(
      "capturedAt,suggestReach,serpFlags,officialPopularity,scoreOutdated,scoreComparability",
    );
  });

  it("exports the signals of a scored row", () => {
    const row = keywordCsv([
      {
        ...keyword("geoguessr"),
        scoreSignals: {
          suggestReach: "hit",
          suggestPrefixLength: 4,
          suggestPosition: 4,
          serpRelevance: 0.1,
          medianRatingCount: 800,
          flags: ["brand", "padded"],
          officialPopularity: 71,
          estimatedTraffic: 4.2,
        },
        scoreOutdated: false,
      },
    ]);
    expect(row).toContain(",hit,brand padded,71,false,");
  });

  it("leaves the evidence empty for a row without signals", () => {
    const row = keywordCsv([
      { ...keyword("focus timer"), scoreSignals: null, scoreOutdated: true },
    ]);
    expect(row).toContain(",,,,true,");
    expect(row).not.toMatch(/null|undefined/);
  });

  it("appends the tags and the note after the existing columns", () => {
    const header = keywordCsv([keyword("focus timer")]).split("\r\n")[0];

    expect(header.endsWith(",scoreComparability,tags,note")).toBe(true);
    expect(header.split(",")).toHaveLength(24);
  });

  it("joins the tags and leaves a missing tag list and note empty", () => {
    const [, tagged, bare] = keywordCsv([
      { ...keyword("focus timer"), tags: ["core", "exam season"], note: "May" },
      keyword("pomodoro"),
    ]).split("\r\n");

    expect(tagged.endsWith(",core; exam season,May")).toBe(true);
    expect(bare.endsWith(",,")).toBe(true);
  });

  it("neutralizes a formula-like note", () => {
    const [, row] = keywordCsv([
      { ...keyword("focus timer"), note: "=HYPERLINK(1)" },
    ]).split("\r\n");

    expect(row.endsWith(",'=HYPERLINK(1)")).toBe(true);
  });
});
