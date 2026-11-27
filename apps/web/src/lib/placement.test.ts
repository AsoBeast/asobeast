import { describe, expect, it } from "vitest";
import type { PlacementSuggestion } from "@asobeast/shared";
import {
  PLACEMENT_LABELS,
  placementSentence,
  type PlacementPart,
} from "./placement";

const suggestion = (
  overrides: Partial<PlacementSuggestion>,
): PlacementSuggestion => ({
  field: "title",
  reason: "strongestReachable",
  popularity: 62,
  difficulty: 70,
  position: 14,
  ...overrides,
});

const words = (parts: PlacementPart[]) =>
  parts.filter((part): part is string => typeof part === "string");

const figures = (parts: PlacementPart[]) =>
  parts.flatMap((part) =>
    typeof part === "string" ? [] : [[part.metric, part.shown]],
  );

describe("PLACEMENT_LABELS", () => {
  it("labels each field", () => {
    expect(PLACEMENT_LABELS.title).toBe("Title");
    expect(PLACEMENT_LABELS.subtitle).toBe("Subtitle");
    expect(PLACEMENT_LABELS.keywordField).toBe("Keyword field");
    expect(PLACEMENT_LABELS.skip).toBe("Skip");
  });
});

describe("placementSentence", () => {
  it("says a reachable strong keyword belongs in the title with its rank", () => {
    const parts = placementSentence(suggestion({}), 80);
    expect(words(parts)).toEqual([
      "Strong popularity ",
      ", you rank ",
      ": belongs in the title.",
    ]);
    expect(figures(parts)).toEqual([
      ["popularity", "62"],
      ["position", "#14"],
    ]);
  });

  it("names the grade of the popularity in the lead", () => {
    const parts = placementSentence(suggestion({ popularity: 45 }), 80);
    expect(words(parts)[0]).toBe("Fair popularity ");
  });

  it("leaves the rank out when there is none", () => {
    const parts = placementSentence(
      suggestion({ position: null, difficulty: 30, popularity: 45 }),
      80,
    );
    expect(words(parts)).toEqual([
      "Fair popularity ",
      " at difficulty ",
      ": belongs in the title.",
    ]);
    expect(figures(parts)).toEqual([
      ["popularity", "45"],
      ["difficulty", "30"],
    ]);
  });

  it("says the next reachable keyword belongs in the subtitle", () => {
    const parts = placementSentence(
      suggestion({ field: "subtitle", reason: "nextReachable" }),
      80,
    );
    expect(words(parts).at(-1)).toBe(": belongs in the subtitle.");
  });

  it("says a hard keyword is for the keyword field", () => {
    const parts = placementSentence(
      suggestion({
        field: "keywordField",
        reason: "hardToRank",
        popularity: 45,
        difficulty: 80,
        position: null,
      }),
      80,
    );
    expect(words(parts)).toEqual([
      "Difficulty ",
      " is at or above popularity ",
      " and you have no recent rank in the top 30: index it in the keyword field.",
    ]);
    expect(figures(parts)).toEqual([
      ["difficulty", "80"],
      ["popularity", "45"],
    ]);
  });

  it.each<[PlacementSuggestion["reason"], string]>([
    [
      "singleWord",
      "A single word: the keyword field indexes it without spending title room.",
    ],
    [
      "longTail",
      "A long tail phrase: the keyword field is enough to be found for it.",
    ],
    [
      "noStrongRoom",
      "The title and subtitle are taken by stronger keywords: index it in the keyword field.",
    ],
    ["noRoom", "The keyword field has no room left for it."],
    [
      "competitorBrand",
      "Another app's brand: store policy keeps it out of your listing.",
    ],
    ["ownBrand", "Your title already makes your own name searchable."],
  ])("explains %s in one sentence", (reason, sentence) => {
    expect(
      placementSentence(suggestion({ field: "keywordField", reason }), 80),
    ).toEqual([sentence]);
  });

  it("quotes a popularity under 20", () => {
    const parts = placementSentence(
      suggestion({ field: "skip", reason: "lowPopularity", popularity: 15 }),
      80,
    );
    expect(words(parts)).toEqual([
      "Popularity ",
      " is under 20: not worth a field yet.",
    ]);
    expect(figures(parts)).toEqual([["popularity", "15"]]);
  });

  it("says a popularity above 20 is a floor answer", () => {
    expect(
      placementSentence(
        suggestion({ field: "skip", reason: "lowPopularity", popularity: 45 }),
        80,
      ),
    ).toEqual([
      "Popularity is under the official floor: not worth a field yet.",
    ]);
  });

  it("quotes the relevance under 60", () => {
    const parts = placementSentence(
      suggestion({ field: "skip", reason: "lowRelevance" }),
      55,
    );
    expect(words(parts)).toEqual([
      "Relevance ",
      " is under 60: it does not describe your app well enough.",
    ]);
    expect(figures(parts)).toEqual([["relevance", "55"]]);
  });
});
