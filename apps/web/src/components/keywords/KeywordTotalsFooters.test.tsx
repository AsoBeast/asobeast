import { renderToStaticMarkup } from "react-dom/server";
import type { Table } from "@tanstack/react-table";
import type { TrackedKeywordItem } from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import type { KeywordTableFeatures } from "./keyword-table-features";
import {
  difficultyFooter,
  keywordCountFooter,
  popularityFooter,
  positionFooter,
} from "./KeywordTotalsFooters";

function keyword(fields: Partial<TrackedKeywordItem>): TrackedKeywordItem {
  return {
    keywordId: "kw-1",
    text: "focus timer",
    country: "us",
    source: "MANUAL",
    active: true,
    latestPosition: null,
    latestDepth: 200,
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

const tableOf = (keywords: TrackedKeywordItem[]) => {
  const rows = keywords.map((original) => ({ original }));
  return {
    table: {
      getRowModel: () => ({ rows }),
    } as unknown as Table<KeywordTableFeatures, TrackedKeywordItem>,
  };
};

const MIXED = tableOf([
  keyword({ latestPosition: 3, volume: 40, difficulty: 2 }),
  keyword({ latestPosition: 12, volume: 60, difficulty: 4 }),
  keyword({ latestPosition: 7 }),
  keyword({ latestPosition: null }),
  keyword({ latestPosition: null, latestDepth: null }),
  keyword({ latestPosition: 45 }),
]);

const textsOf = (html: string): string[] =>
  [...html.matchAll(/>([^<]+)</g)].map((match) => match[1]);

describe("the keyword totals footers", () => {
  it("counts the keywords and splits them by their check", () => {
    const html = renderToStaticMarkup(keywordCountFooter(MIXED));

    expect(textsOf(html)).toEqual([
      "6 keywords",
      "4 ranked, 1 not found, 1 not checked",
    ]);
  });

  it("leaves out the not checked part when every keyword was checked", () => {
    const html = renderToStaticMarkup(
      keywordCountFooter(tableOf([keyword({ latestPosition: 4 })])),
    );

    expect(textsOf(html)).toEqual(["1 keyword", "1 ranked, 0 not found"]);
  });

  it("averages the ranked positions and counts the top 10", () => {
    expect(textsOf(renderToStaticMarkup(positionFooter(MIXED)))).toEqual([
      "avg 16.8",
      "2 in the top 10",
    ]);
  });

  it("names the dash of a table without ranked keywords", () => {
    const html = renderToStaticMarkup(
      positionFooter(tableOf([keyword({ latestPosition: null })])),
    );

    expect(textsOf(html)).toEqual(["—", "No ranked keywords"]);
    expect(html).toContain('aria-hidden="true">—');
  });

  it("averages popularity and difficulty over the scored rows", () => {
    expect(textsOf(renderToStaticMarkup(popularityFooter(MIXED)))).toEqual([
      "avg 50",
    ]);
    expect(textsOf(renderToStaticMarkup(difficultyFooter(MIXED)))).toEqual([
      "avg 30",
    ]);
  });

  it("names the dash of a table without scored keywords", () => {
    const unscored = tableOf([keyword({})]);

    expect(textsOf(renderToStaticMarkup(popularityFooter(unscored)))).toEqual([
      "—",
      "No scored keywords",
    ]);
    expect(textsOf(renderToStaticMarkup(difficultyFooter(unscored)))).toEqual([
      "—",
      "No scored keywords",
    ]);
  });

  it("writes each figure as one string in its own element", () => {
    for (const footer of [
      keywordCountFooter,
      positionFooter,
      popularityFooter,
      difficultyFooter,
    ]) {
      const html = renderToStaticMarkup(footer(MIXED));
      expect(html).not.toContain("<!-- -->");
      expect(html).not.toMatch(/>[^<]+<(?!\/)/);
    }
  });
});
