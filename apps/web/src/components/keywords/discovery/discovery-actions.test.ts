import type { KeywordDiscoveryItem } from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import {
  bulkLabels,
  rankedIds,
  recommendedIds,
  selectedIn,
} from "./discovery-actions";

const item = (
  keywordId: string,
  state: KeywordDiscoveryItem["state"],
  recommended: boolean,
): KeywordDiscoveryItem => ({
  keywordId,
  text: keywordId,
  country: "us",
  source: "title",
  position: state === "ranked" ? 2 : null,
  depth: 200,
  checkedOn: "2026-11-03",
  traffic: null,
  difficulty: null,
  volume: null,
  relevance: 80,
  opportunity: null,
  state,
  recommended,
});

const ITEMS = [
  item("a", "ranked", true),
  item("b", "open", true),
  item("c", "ranked", false),
  item("d", "opportunity", false),
];

describe("bulk targets", () => {
  it("picks the recommended rows in list order", () => {
    expect(recommendedIds(ITEMS)).toEqual(["a", "b"]);
  });

  it("picks the ranked rows in list order", () => {
    expect(rankedIds(ITEMS)).toEqual(["a", "c"]);
  });

  it("keeps only the selected rows the list still holds, in list order", () => {
    expect(
      selectedIn(ITEMS, { d: true, a: true, gone: true, b: false }),
    ).toEqual(["a", "d"]);
  });
});

describe("bulkLabels", () => {
  it("names the count of each bulk action", () => {
    expect(bulkLabels({ selected: 3, recommended: 50, ranked: 28 })).toEqual({
      selected: "Track selected (3)",
      recommended: "Track recommended (50)",
      ranked: "Track all ranked (28)",
    });
    expect(bulkLabels({ selected: 0, recommended: 0, ranked: 0 })).toEqual({
      selected: "Track selected (0)",
      recommended: "Track recommended (0)",
      ranked: "Track all ranked (0)",
    });
  });
});
