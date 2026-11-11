import { renderToStaticMarkup } from "react-dom/server";
import type { Table } from "@tanstack/react-table";
import type { TrackedKeywordItem } from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import type { KeywordTableFeatures } from "./keyword-table-features";
import {
  dayChangeFooter,
  difficultyFooter,
  keywordCountFooter,
  movedFooter,
  opportunityFooter,
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

  it("counts the keywords that moved up and down over 7 days", () => {
    const moved = tableOf([
      keyword({ positionDelta7d: -7 }),
      keyword({ positionDelta7d: 6 }),
      keyword({ positionDelta7d: 5 }),
      keyword({ positionDelta7d: null }),
    ]);

    expect(textsOf(renderToStaticMarkup(movedFooter(moved)))).toEqual([
      "1 up",
      "2 down",
    ]);
  });

  it("counts yesterday's moves and the keywords that dropped out", () => {
    const today = "2026-11-11";
    const checked = { latestCheckedOn: today };
    const moved = tableOf([
      keyword({ ...checked, latestPosition: 3, previousPosition: 5 }),
      keyword({ ...checked, latestPosition: 9, previousPosition: 4 }),
      keyword({ ...checked, latestPosition: null, previousPosition: 14 }),
      keyword({ ...checked, latestPosition: 7, previousPosition: 7 }),
      keyword({
        ...checked,
        active: false,
        latestPosition: 30,
        previousPosition: 20,
      }),
    ]);

    expect(
      textsOf(renderToStaticMarkup(dayChangeFooter(moved, today))),
    ).toEqual(["1 up, 1 down", "1 lost"]);
  });

  it("averages opportunity over the scored rows", () => {
    const scored = tableOf([
      keyword({ opportunity: 80 }),
      keyword({ opportunity: 41 }),
      keyword({}),
    ]);

    expect(textsOf(renderToStaticMarkup(opportunityFooter(scored)))).toEqual([
      "avg 61",
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
      movedFooter,
      positionFooter,
      popularityFooter,
      difficultyFooter,
    ]) {
      const html = renderToStaticMarkup(footer(MIXED));
      expect(html).not.toContain("<!-- -->");
      expect(html).not.toMatch(/>[^<]+<(?!\/)/);
    }
  });

  it("groups the digits of a large count like the row count", () => {
    const many = tableOf(
      Array.from({ length: 1234 }, (_, index) =>
        keyword({ latestPosition: index % 2 === 0 ? 5 : null }),
      ),
    );

    expect(textsOf(renderToStaticMarkup(keywordCountFooter(many)))).toEqual([
      "1,234 keywords",
      "617 ranked, 617 not found",
    ]);
    expect(textsOf(renderToStaticMarkup(positionFooter(many)))).toEqual([
      "avg 5",
      "617 in the top 10",
    ]);
  });
});
