import { describe, expect, it } from "vitest";
import { detectColumns, headerKey } from "./columns";

const EXPORT_HEADER = [
  "keyword",
  "source",
  "active",
  "position",
  "delta1d",
  "delta7d",
  "volatility",
  "popularity",
  "difficulty",
  "opportunity",
  "bucket",
  "relevance",
  "scoredAt",
  "scoringSource",
  "formulaVersion",
  "confidence",
  "capturedAt",
  "suggestReach",
  "serpFlags",
  "officialPopularity",
  "scoreOutdated",
  "scoreComparability",
  "tags",
  "note",
  "country",
];

describe("headerKey", () => {
  it.each([
    ["Search Term", "searchterm"],
    ["search_term", "searchterm"],
    [" KEYWORDS ", "keywords"],
    ["Keyword (s)", "keywords"],
    ["Ｋeyword", "keyword"],
  ])("folds %j to %j", (header, key) => {
    expect(headerKey(header)).toBe(key);
  });
});

describe("detectColumns", () => {
  it("finds the columns of asobeast's own export and ignores the rest", () => {
    expect(detectColumns(EXPORT_HEADER)).toEqual({
      keyword: 0,
      country: 24,
      tags: 22,
      note: 23,
    });
  });

  it.each([
    ["Keyword Phrase", "keyword"],
    ["Query", "keyword"],
    ["Storefront", "country"],
    ["Country Code", "country"],
    ["Groups", "tags"],
    ["Labels", "tags"],
    ["Comments", "note"],
  ] as const)("maps the header %j to %s", (header, field) => {
    const header2 = field === "keyword" ? [header] : ["keyword", header];

    expect(detectColumns(header2)?.[field]).toBe(field === "keyword" ? 0 : 1);
  });

  it("answers null for a first row that is data", () => {
    expect(detectColumns(["habit tracker", "us"])).toBeNull();
  });

  it("answers null when no column names the keyword", () => {
    expect(detectColumns(["country", "tags"])).toBeNull();
  });

  it("uses a column for one field only", () => {
    expect(detectColumns(["keyword", "keywords", "term"])).toEqual({
      keyword: 0,
      country: null,
      tags: null,
      note: null,
    });
  });

  it("takes the left most column when two name the same field", () => {
    expect(detectColumns(["keyword", "market", "country"])?.country).toBe(1);
  });
});
