import { describe, expect, it } from "vitest";
import {
  EMPTY_COPY,
  STRATEGIES,
  storeLookupLabels,
  USED_BY_NOUN,
} from "./suggestion-strategies";

describe("suggestion strategies", () => {
  it("lists competitor searches after competitors", () => {
    const values = STRATEGIES.map((entry) => entry.value);
    expect(values.indexOf("competitorSearch")).toBe(
      values.indexOf("competitors") + 1,
    );
    expect(
      STRATEGIES.find((entry) => entry.value === "competitorSearch"),
    ).toEqual({
      value: "competitorSearch",
      label: "Competitor searches",
      description: "What people search around your competitors' phrases",
    });
    expect(USED_BY_NOUN.competitorSearch).toBe("competitor");
    expect(EMPTY_COPY.competitorSearch).toBe(
      "Your competitors' titles share no phrase to search from in this market yet.",
    );
  });

  it("every store strategy is described as a live lookup", () => {
    expect(storeLookupLabels()).toEqual([
      "Search",
      "Similar apps",
      "More by developer",
      "Competitor searches",
    ]);
  });
});
