import type {
  KeywordInspectionResult,
  KeywordInspectionSummary,
  ScoreSignals,
} from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import {
  autocompleteLine,
  changeTone,
  competitionFacts,
  inspectionCostText,
  inspectionCountry,
  newcomerCount,
  otherStorefronts,
  scoreChange,
  shownScore,
  signedChange,
  sinceUpdate,
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

  it("adds the newcomers when the release dates are known", () => {
    const facts = competitionFacts(
      {
        topCount: 10,
        medianRatingCount: 16_000,
        strongestRatingCount: 250_000,
        averageRating: 4.5,
        exactTitleMatches: 2,
        titleMatches: 7,
        appsOverHundredThousandRatings: 2,
        medianDaysSinceUpdate: 12,
        freshlyUpdated: 8,
      },
      2,
    );

    expect(facts.at(-1)).toEqual({
      label: "Newcomers",
      value: "2 of 10",
      note: "Released in the last year",
    });
  });
});

describe("inspectionCostText", () => {
  const daily = { onDemand: { score: { limit: 100, windowSeconds: 86_400 } } };
  it("names the daily figure of the plan", () => {
    expect(inspectionCostText(daily as never)).toBe(
      "Each inspection uses one of the 100 on demand scores your plan allows a day.",
    );
  });

  it("says a plan without scores includes none", () => {
    expect(
      inspectionCostText({
        onDemand: { score: { limit: 0, windowSeconds: 86_400 } },
      } as never),
    ).toBe("Your plan includes no on demand scores.");
  });

  it("falls back to the store read when no limit applies", () => {
    expect(inspectionCostText(undefined)).toBe(
      "Each inspection reads the store once.",
    );
    expect(inspectionCostText({ onDemand: null })).toBe(
      "Each inspection reads the store once.",
    );
  });
});

describe("sinceUpdate", () => {
  const at = "2026-11-14T08:00:00.000Z";
  it("words the age of an update in days, then months", () => {
    expect(sinceUpdate("2026-11-14T01:00:00.000Z", at)).toBe("updated today");
    expect(sinceUpdate("2026-11-13T07:00:00.000Z", at)).toBe(
      "updated 1 day ago",
    );
    expect(sinceUpdate("2026-09-20T00:00:00.000Z", at)).toBe(
      "updated 55 days ago",
    );
    expect(sinceUpdate("2026-08-10T00:00:00.000Z", at)).toBe(
      "updated 3 months ago",
    );
  });

  it("says nothing without an update date and never goes negative", () => {
    expect(sinceUpdate(null, at)).toBeNull();
    expect(sinceUpdate("2026-11-20T00:00:00.000Z", at)).toBe("updated today");
  });
});

describe("newcomerCount", () => {
  const result = (releasedAt: string | null) =>
    ({ releasedAt }) as KeywordInspectionResult;
  const at = "2026-11-14T00:00:00.000Z";

  it("counts the top apps released within the last year", () => {
    expect(
      newcomerCount(
        [
          result("2026-04-01T00:00:00.000Z"),
          result("2019-01-01T00:00:00.000Z"),
          result("2025-11-14T00:00:00.000Z"),
          result("2026-10-01T00:00:00.000Z"),
        ],
        3,
        at,
      ),
    ).toBe(2);
  });

  it("is unknown when no top app carries a release date", () => {
    expect(newcomerCount([result(null), result(null)], 2, at)).toBeNull();
    expect(newcomerCount([], 10, at)).toBeNull();
  });
});

describe("autocompleteLine", () => {
  const signals = (patch: Partial<ScoreSignals>) =>
    ({
      suggestReach: "hit",
      suggestPrefixLength: 5,
      suggestPosition: 1,
      ...patch,
    }) as ScoreSignals;

  it("says where and after how many characters the store suggests it", () => {
    expect(autocompleteLine(signals({}))).toBe(
      "Autocomplete suggests it in position 1 after 5 typed characters",
    );
    expect(autocompleteLine(signals({ suggestPrefixLength: null }))).toBe(
      "Autocomplete suggests it while it is typed",
    );
  });

  it("words the other reaches and stays quiet without a reading", () => {
    expect(autocompleteLine(signals({ suggestReach: "listed" }))).toBe(
      "Autocomplete suggests it only once the whole phrase is typed",
    );
    expect(autocompleteLine(signals({ suggestReach: "absent" }))).toBe(
      "Autocomplete never suggests it",
    );
    expect(
      autocompleteLine(signals({ suggestReach: "unavailable" })),
    ).toBeNull();
    expect(autocompleteLine(null)).toBeNull();
  });
});

describe("otherStorefronts", () => {
  const item = (
    id: string,
    patch: Partial<KeywordInspectionSummary>,
  ): KeywordInspectionSummary => ({
    id,
    keywordId: id,
    keyword: "habit tracker",
    store: "APP_STORE",
    country: "us",
    status: "DONE",
    requestedAt: "2026-11-14T00:00:00.000Z",
    startedAt: null,
    completedAt: null,
    volume: 40,
    difficulty100: 30,
    opportunity: 50,
    resultCount: 10,
    ...patch,
  });

  it("lists the newest finished inspection of the keyword per other storefront", () => {
    const items = [
      item("us", {}),
      item("play", { store: "GOOGLE_PLAY" }),
      item("play-old", { store: "GOOGLE_PLAY" }),
      item("de", { country: "de", keyword: "Habit Tracker" }),
      item("gb-running", { country: "gb", status: "PENDING" }),
      item("other", { country: "fr", keyword: "mood journal" }),
    ];
    expect(
      otherStorefronts(items, {
        keyword: "habit tracker",
        store: "APP_STORE",
        country: "us",
      }).map((entry) => entry.id),
    ).toEqual(["play", "de"]);
  });
});
