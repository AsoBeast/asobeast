import { describe, expect, it } from "vitest";
import { comparisonMarkets, marketOptions } from "./comparison-markets";

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
