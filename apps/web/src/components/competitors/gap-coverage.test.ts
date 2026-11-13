import { describe, expect, it } from "vitest";
import { coverageLine } from "./gap-coverage";

const coverage = {
  competitors: 1,
  delisted: 0,
  markets: [
    { country: "de", keywords: 1, compared: 1 },
    { country: "pl", keywords: 2, compared: 0 },
    { country: "us", keywords: 8, compared: 8 },
  ],
};

describe("coverageLine", () => {
  it("sums every market when none is chosen", () => {
    expect(coverageLine(coverage, "")).toBe(
      "Compared on 9 of 11 keywords in 3 markets",
    );
  });

  it("reads one market without naming a count of markets", () => {
    expect(coverageLine(coverage, "de")).toBe("Compared on 1 of 1 keyword");
    expect(coverageLine(coverage, "pl")).toBe("Compared on 0 of 2 keywords");
  });

  it("says nothing without coverage or for an unknown market", () => {
    expect(coverageLine(undefined, "")).toBeNull();
    expect(coverageLine(coverage, "fr")).toBeNull();
    expect(coverageLine({ ...coverage, markets: [] }, "")).toBeNull();
  });
});
