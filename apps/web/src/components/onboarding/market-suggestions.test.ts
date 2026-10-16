import { describe, expect, it } from "vitest";
import type {
  MarketSuggestion,
  MarketSuggestionsResult,
} from "@asobeast/shared";
import {
  groupSuggestions,
  languageNames,
  marketCostSummary,
  marketCostText,
} from "./market-suggestions";

const suggestion = (
  country: string,
  localization: MarketSuggestion["localization"],
  role: MarketSuggestion["role"] = "default",
  tracked = false,
): MarketSuggestion => ({
  country,
  localization,
  language: localization.split("-")[0],
  role,
  tracked,
  dailyRequests: { listing: 2, perKeyword: 1 },
});

const RESULT: MarketSuggestionsResult = {
  home: "us",
  languages: ["de", "en", "fr", "xx"],
  suggestions: [
    suggestion("at", "de"),
    suggestion("ch", "de"),
    suggestion("de", "de", "default", true),
    suggestion("fr", "fr"),
    suggestion("ca", "fr-CA", "additional"),
    suggestion("be", "fr", "additional"),
  ],
};

describe("groupSuggestions", () => {
  it("groups by localization in the order the suggestions arrive", () => {
    expect(
      groupSuggestions(RESULT).map((group) => [
        group.name,
        group.markets.map((market) => market.country),
      ]),
    ).toEqual([
      ["German", ["at", "ch", "de"]],
      ["French", ["fr", "be"]],
      ["French (Canada)", ["ca"]],
    ]);
  });

  it("lists every storefront once", () => {
    const countries = groupSuggestions(RESULT).flatMap((group) =>
      group.markets.map((market) => market.country),
    );

    expect(countries.filter((country) => country === "ch")).toHaveLength(1);
  });

  it("answers no group without a suggestion", () => {
    expect(groupSuggestions({ ...RESULT, suggestions: [] })).toEqual([]);
  });
});

describe("languageNames", () => {
  it("names english first, every language without its region and an unknown code as itself", () => {
    expect(languageNames(RESULT)).toEqual([
      "English",
      "German",
      "French",
      "XX",
    ]);
  });

  it("names a language the app store has no localization for", () => {
    expect(
      languageNames({ ...RESULT, languages: ["en", "be", "fa", "uz"] }),
    ).toEqual(["English", "Belarusian", "Persian", "Uzbek"]);
  });

  it("names both chinese scripts and portuguese by their language", () => {
    expect(languageNames({ ...RESULT, languages: ["zh", "pt", "es"] })).toEqual(
      ["Chinese", "Portuguese", "Spanish"],
    );
  });
});

describe("marketCostText", () => {
  it("words the listing reads and the requests per keyword", () => {
    expect(marketCostText(suggestion("de", "de"))).toBe(
      "2 listing reads a day, 1 per keyword",
    );
    expect(
      marketCostText({
        ...suggestion("de", "de"),
        dailyRequests: { listing: 1, perKeyword: 8 },
      }),
    ).toBe("1 listing read a day, 8 per keyword");
  });
});

describe("marketCostSummary", () => {
  it("words the cost of a market for each store", () => {
    expect(marketCostSummary("APP_STORE")).toBe(
      "A market adds one listing read a day for the app and for every competitor, one more for each localization captured there, and one search a day for every keyword tracked there. Seeding tracks up to 15 keywords from the market's own title and subtitle; each one adds a daily search.",
    );
    expect(marketCostSummary("GOOGLE_PLAY")).toBe(
      "A market adds one listing read a day for the app and for every competitor, and one search a day for every keyword tracked there.",
    );
  });
});
