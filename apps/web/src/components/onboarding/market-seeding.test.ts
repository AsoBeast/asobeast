import { describe, expect, it } from "vitest";
import type { MarketSeedResult, MarketSuggestion } from "@asobeast/shared";
import {
  defaultSeedChoice,
  outcomeOf,
  outcomeText,
  seedButtonLabel,
  seedChosen,
  seedPlan,
  seedStatusText,
  withoutOutcomes,
} from "./market-seeding";

const GERMANY: MarketSuggestion = {
  country: "de",
  localization: "de",
  language: "de",
  role: "default",
  tracked: false,
  dailyRequests: { listing: 2, perKeyword: 1 },
};

const seedResult = (
  over: Partial<MarketSeedResult> = {},
): MarketSeedResult => ({
  country: "de",
  status: "seeded",
  seeded: 9,
  skipped: 0,
  cost: { store: "APP_STORE", keywordMarkets: 9, dailyRequests: 10 },
  ...over,
});

describe("defaultSeedChoice", () => {
  it("seeds a storefront whose default is the localization, not one that also reads it", () => {
    expect(defaultSeedChoice(GERMANY)).toBe(true);
    expect(defaultSeedChoice({ ...GERMANY, role: "additional" })).toBe(false);
  });
});

describe("seedChosen", () => {
  it("falls back to the default choice for a market the owner left alone", () => {
    expect(seedChosen(GERMANY, new Map())).toBe(true);
    expect(seedChosen({ ...GERMANY, role: "additional" }, new Map())).toBe(
      false,
    );
  });

  it("keeps the owner's choice", () => {
    expect(seedChosen(GERMANY, new Map([["de", false]]))).toBe(false);
  });
});

describe("withoutOutcomes", () => {
  it("drops the outcomes of the markets a new run adds", () => {
    expect(
      withoutOutcomes(
        {
          jp: { kind: "unavailable" },
          at: { kind: "seeded", seeded: 2, skipped: 0 },
        },
        ["jp"],
      ),
    ).toEqual({ at: { kind: "seeded", seeded: 2, skipped: 0 } });
  });
});

describe("seedButtonLabel", () => {
  it.each([
    [0, 0, "Add markets"],
    [1, 0, "Add 1 market"],
    [1, 1, "Add 1 market and seed 1"],
    [3, 2, "Add 3 markets and seed 2"],
  ])("labels %i markets with %i seeds as %s", (markets, seeds, label) => {
    expect(seedButtonLabel(markets, seeds)).toBe(label);
  });
});

describe("seedPlan", () => {
  it("selects every ticked market and seeds the ticked ones chosen for seeding in order", () => {
    expect(seedPlan(["jp", "de", "at"], new Set(["at", "de", "fr"]))).toEqual({
      select: ["jp", "de", "at"],
      seed: ["de", "at"],
    });
  });
});

describe("outcomeOf", () => {
  it("reads a seed and a storefront without the app", () => {
    expect(outcomeOf(seedResult({ skipped: 2 }))).toEqual({
      kind: "seeded",
      seeded: 9,
      skipped: 2,
    });
    expect(outcomeOf(seedResult({ status: "unavailable", seeded: 0 }))).toEqual(
      { kind: "unavailable" },
    );
  });
});

describe("outcomeText", () => {
  it("names no language, because the seed reads every localization the storefront captures", () => {
    expect(outcomeText({ kind: "seeded", seeded: 3, skipped: 0 })).toBe(
      "Seeded 3 keywords from its listing",
    );
  });

  it.each([
    [
      { kind: "seeded", seeded: 9, skipped: 0 },
      "Seeded 9 keywords from its listing",
    ],
    [
      { kind: "seeded", seeded: 1, skipped: 3 },
      "Seeded 1 keyword from its listing, 3 left out by the keyword limit",
    ],
    [
      { kind: "seeded", seeded: 0, skipped: 0 },
      "No new keywords in its listing",
    ],
    [
      { kind: "seeded", seeded: 0, skipped: 2 },
      "Seeded no keywords, 2 left out by the keyword limit",
    ],
    [
      { kind: "unavailable" },
      "Not published on this storefront, so it was not added",
    ],
    [
      { kind: "failed", message: "Refresh limit reached" },
      "Refresh limit reached",
    ],
  ] as const)("words %j", (outcome, text) => {
    expect(outcomeText(outcome)).toBe(text);
  });
});

describe("seedStatusText", () => {
  it("says a seed runs until its outcome arrives, then words the outcome", () => {
    expect(seedStatusText(true, undefined)).toBe("Seeding from its listing…");
    expect(seedStatusText(true, { kind: "unavailable" })).toBe(
      "Not published on this storefront, so it was not added",
    );
    expect(seedStatusText(false, undefined)).toBeNull();
  });
});
