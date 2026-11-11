import { renderToStaticMarkup } from "react-dom/server";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import type { TrackedKeywordItem } from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import { KeywordMap } from "./KeywordMap";
import { filtersNarrowMap } from "./map-points";

const keyword = (
  text: string,
  scores: Partial<TrackedKeywordItem> = {},
): TrackedKeywordItem => ({
  keywordId: `kw-${text}`,
  text,
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
  scoreSignals: null,
  ...scores,
});

const scored = (text: string, difficulty: number) =>
  keyword(text, { volume: 40, difficulty, opportunity: 50 });

const noticeOf = (
  keywords: readonly TrackedKeywordItem[],
  narrowed: boolean,
): string =>
  renderToStaticMarkup(
    <NuqsTestingAdapter>
      <KeywordMap
        keywords={keywords}
        narrowed={narrowed}
        history={{
          appId: "app-1",
          store: "APP_STORE",
          homeCountry: "us",
          multiMarket: false,
        }}
        market="us"
        today="2026-11-06"
        onClearFilters={() => undefined}
      />
    </NuqsTestingAdapter>,
  )
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

describe("the empty opportunity map", () => {
  it("blames the filters, not scoring, when they leave only unscored keywords", () => {
    const notice = noticeOf([keyword("boarding pass wallet")], true);

    expect(notice).toContain("No scored keywords match these filters");
    expect(notice).toContain(
      "1 keyword matches these filters, and it does not have both a popularity and a difficulty.",
    );
    expect(notice).toContain("Clear filters");
    expect(notice).not.toContain("weekly scoring run");
  });

  it("counts every filtered keyword without a pair of scores", () => {
    const notice = noticeOf([keyword("one"), keyword("two")], true);

    expect(notice).toContain(
      "2 keywords match these filters, and none has both a popularity and a difficulty.",
    );
  });

  it("waits for scoring when no filter narrows the map", () => {
    const notice = noticeOf([keyword("boarding pass wallet")], false);

    expect(notice).toContain("Nothing to map yet");
    expect(notice).toContain("Scores arrive with the weekly scoring run.");
    expect(notice).not.toContain("Clear filters");
  });

  it("counts what the filters leave when they narrow the map below four", () => {
    const notice = noticeOf([scored("one", 2), scored("two", 3)], true);

    expect(notice).toContain("Too few scored keywords");
    expect(notice).toContain(
      "The map needs at least 4 keywords with both scores. These filters leave 2.",
    );
    expect(notice).toContain("Clear filters");
  });

  it("counts the scored keywords still to come when nothing is filtered", () => {
    const notice = noticeOf([scored("one", 2), scored("two", 3)], false);

    expect(notice).toContain(
      "The map needs at least 4 keywords with both scores. 2 of 4 so far.",
    );
    expect(notice).not.toContain("Clear filters");
  });
});

describe("filtersNarrowMap", () => {
  it("narrows the map when the filters remove a plotted keyword", () => {
    const kept = scored("one", 2);

    expect(filtersNarrowMap([kept], [kept, scored("two", 3)])).toBe(true);
  });

  it("does not narrow the map when the filters remove only unscored keywords", () => {
    const kept = [scored("one", 2), scored("two", 3)];

    expect(
      filtersNarrowMap(kept, [...kept, keyword("three"), keyword("four")]),
    ).toBe(false);
  });

  it("leaves a fully unscored list waiting for scores under a filter", () => {
    const kept = keyword("one");

    expect(filtersNarrowMap([kept], [kept, keyword("two")])).toBe(false);
  });

  it("does not narrow the map when nothing is filtered", () => {
    const all = [scored("one", 2), keyword("two")];

    expect(filtersNarrowMap(all, all)).toBe(false);
  });
});
