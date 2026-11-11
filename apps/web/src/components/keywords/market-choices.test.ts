import { describe, expect, it } from "vitest";
import { marketChoices } from "./market-choices";

const MARKETS = [
  { country: "us", keywordCount: 5 },
  { country: "pl", keywordCount: 0 },
];

describe("marketChoices", () => {
  it("lists every tracked market with its keyword count", () => {
    expect(marketChoices(MARKETS, "us")).toEqual([
      { country: "us", count: 5 },
      { country: "pl", count: 0 },
    ]);
  });

  it("adds a selected market that tracks nothing yet", () => {
    expect(marketChoices(MARKETS, "fr")).toEqual([
      { country: "us", count: 5 },
      { country: "pl", count: 0 },
      { country: "fr", count: 0 },
    ]);
  });
});
