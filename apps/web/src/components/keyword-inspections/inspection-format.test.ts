import { describe, expect, it } from "vitest";
import {
  changeTone,
  competitionFacts,
  inspectionCountry,
  scoreChange,
  shownScore,
  signedChange,
  updatedAgo,
} from "./inspection-format";

describe("shownScore", () => {
  it("rounds a score and shows a dash for a missing one", () => {
    expect(shownScore(41.6)).toBe("42");
    expect(shownScore(0)).toBe("0");
    expect(shownScore(null)).toBe("—");
  });
});

describe("scoreChange", () => {
  it("compares the rounded scores", () => {
    expect(scoreChange(41.6, 39.4)).toBe(3);
    expect(scoreChange(10, 10.2)).toBe(0);
    expect(scoreChange(null, 10)).toBeNull();
    expect(scoreChange(10, null)).toBeNull();
  });
});

describe("signedChange", () => {
  it("signs a change and words a missing or flat one", () => {
    expect(signedChange(3)).toBe("+3");
    expect(signedChange(-2)).toBe("−2");
    expect(signedChange(0)).toBe("no change");
    expect(signedChange(null)).toBe("—");
  });
});

describe("changeTone", () => {
  it("reads a rise as better only for a score where higher is better", () => {
    expect(changeTone(5, true)).toBe("better");
    expect(changeTone(-5, true)).toBe("worse");
    expect(changeTone(14, false)).toBe("worse");
    expect(changeTone(-3, false)).toBe("better");
  });

  it("treats a flat or missing change as the same", () => {
    expect(changeTone(0, true)).toBe("same");
    expect(changeTone(null, false)).toBe("same");
  });
});

describe("updatedAgo", () => {
  it("words today, one day and several days", () => {
    expect(updatedAgo(0)).toBe("Typically updated today");
    expect(updatedAgo(1)).toBe("Typical update 1 day ago");
    expect(updatedAgo(18)).toBe("Typical update 18 days ago");
  });
});

describe("inspectionCountry", () => {
  it("falls back to the United States when the URL names no country", () => {
    expect(inspectionCountry("")).toBe("us");
    expect(inspectionCountry("de")).toBe("de");
  });
});

describe("competitionFacts", () => {
  it("describes the top results and shows dashes for missing figures", () => {
    const facts = competitionFacts({
      topCount: 10,
      medianRatingCount: null,
      strongestRatingCount: 250_000,
      averageRating: 4.36,
      exactTitleMatches: 2,
      titleMatches: 5,
      appsOverHundredThousandRatings: 1,
      medianDaysSinceUpdate: null,
      freshlyUpdated: 3,
    });

    expect(facts.map((fact) => [fact.label, fact.value])).toEqual([
      ["Typical ratings", "—"],
      ["Strongest app", "250K"],
      ["Average rating", "4.4"],
      ["Titles that target it", "5 of 10"],
      ["Heavyweights", "1 of 10"],
      ["Recently updated", "3 of 10"],
    ]);
    expect(facts[3].note).toBe("2 with the exact phrase");
    expect(facts[5].note).toBe("Update dates unavailable");
  });
});
