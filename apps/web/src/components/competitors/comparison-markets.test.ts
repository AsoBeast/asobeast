import { describe, expect, it } from "vitest";
import {
  comparisonMarkets,
  gapMarkets,
  marketOptions,
} from "./comparison-markets";

const rows = (...countries: string[]) =>
  countries.map((country) => ({ country }));

describe("comparisonMarkets", () => {
  it("answers each market once, home first", () => {
    expect(comparisonMarkets(rows("de", "us", "de", "fr"), "us")).toEqual([
      "us",
      "fr",
      "de",
    ]);
  });

  it("leaves home out when no row is in it", () => {
    expect(comparisonMarkets(rows("de", "fr"), "us")).toEqual(["fr", "de"]);
  });

  it("answers one market for single market rows", () => {
    expect(comparisonMarkets(rows("us", "us"), "us")).toEqual(["us"]);
  });

  it("answers nothing for no rows", () => {
    expect(comparisonMarkets([], "us")).toEqual([]);
  });

  it("keeps a selected market no row is in", () => {
    expect(comparisonMarkets(rows("us", "us"), "us", "de")).toEqual([
      "us",
      "de",
    ]);
    expect(comparisonMarkets(rows("de", "fr"), "us", "it")).toEqual([
      "fr",
      "de",
      "it",
    ]);
  });

  it("adds nothing for a selected market the rows already hold", () => {
    expect(comparisonMarkets(rows("us"), "us", "us")).toEqual(["us"]);
    expect(comparisonMarkets(rows("us"), "us", "")).toEqual(["us"]);
  });
});

describe("marketOptions", () => {
  it("starts with every market and names each storefront", () => {
    expect(marketOptions(["us", "de"])).toEqual([
      { value: "all", label: "All markets" },
      { value: "us", label: "United States" },
      { value: "de", label: "Germany" },
    ]);
  });
});

describe("gapMarkets", () => {
  it("lists the compared markets home first, then by name", () => {
    expect(
      gapMarkets(
        {
          competitors: 1,
          delisted: 0,
          markets: [
            { country: "pl", keywords: 2, compared: 0 },
            { country: "de", keywords: 1, compared: 1 },
            { country: "us", keywords: 8, compared: 8 },
          ],
        },
        "us",
      ),
    ).toEqual(["us", "de", "pl"]);
  });

  it("lists nothing without coverage", () => {
    expect(gapMarkets(undefined, "us")).toEqual([]);
  });
});
