import { describe, expect, it } from "vitest";
import type {
  CompetitorSuggestion,
  CompetitorSuggestions,
} from "@asobeast/shared";
import {
  addButtonLabel,
  discoveredEmptyText,
  discoveredRows,
  suggestionMeta,
} from "./discovered-apps";

const serp = (appearances: number): CompetitorSuggestion => ({
  storeAppId: `serp-${appearances}`,
  title: "Ranked",
  developer: null,
  iconUrl: null,
  source: "serp",
  appearances,
  bestPosition: 4,
});

const similar: CompetitorSuggestion = {
  storeAppId: "similar-1",
  title: "Similar",
  developer: "Dev",
  iconUrl: null,
  source: "similar",
  appearances: null,
  bestPosition: null,
};

const suggestions = (items: CompetitorSuggestion[]): CompetitorSuggestions => ({
  store: "APP_STORE",
  country: "us",
  similar: "ok",
  items,
});

describe("discoveredRows", () => {
  it("answers nothing before the suggestions load", () => {
    expect(discoveredRows(undefined)).toEqual([]);
  });

  it("keeps the rows in api order", () => {
    expect(discoveredRows(suggestions([serp(2), similar]))).toEqual([
      serp(2),
      similar,
    ]);
  });
});

describe("suggestionMeta", () => {
  it("says how often and how high a serp app ranks", () => {
    expect(suggestionMeta(serp(2), "APP_STORE")).toBe(
      "2 appearances · best #4",
    );
    expect(suggestionMeta(serp(1), "APP_STORE")).toBe("1 appearance · best #4");
  });

  it("names the store that lists a similar app", () => {
    expect(suggestionMeta(similar, "APP_STORE")).toBe(
      "Similar on the App Store",
    );
    expect(suggestionMeta(similar, "GOOGLE_PLAY")).toBe(
      "Similar on Google Play",
    );
  });
});

describe("addButtonLabel", () => {
  it("counts the ticked rows", () => {
    expect(addButtonLabel(0)).toBe("Add selected");
    expect(addButtonLabel(1)).toBe("Add 1 selected");
    expect(addButtonLabel(2)).toBe("Add 2 selected");
  });
});

describe("discoveredEmptyText", () => {
  it("says positions are still collected while the first run collects", () => {
    expect(discoveredEmptyText(true, "unavailable")).toBe(
      "Positions are still being collected. Apps that rank for your keywords appear here within minutes.",
    );
  });

  it("says the store listed nothing when the similar lookup failed", () => {
    expect(discoveredEmptyText(false, "unavailable")).toBe(
      "The store did not list similar apps right now.",
    );
  });

  it("says nothing is suggested yet otherwise", () => {
    expect(discoveredEmptyText(false, "ok")).toBe("No suggestions yet.");
  });
});
