import { describe, expect, it } from "vitest";
import type { CompetitorGapKeyword, CompetitorGaps } from "@asobeast/shared";
import { gapHeadline, headlineLink, headlineText } from "./gap-headline";

const RIVAL = { id: "comp-1", name: "Rival Focus" };

const row = (
  over: Partial<CompetitorGapKeyword> = {},
): CompetitorGapKeyword => ({
  keywordId: "kw-4",
  text: "productivity app",
  volume: 65,
  difficulty: 60,
  opportunity: 38,
  yourPosition: null,
  bestCompetitorPosition: 8,
  bestCompetitorId: "comp-1",
  gap: null,
  country: "us",
  ...over,
});

const gaps = (
  winnable: CompetitorGapKeyword[],
  threats: CompetitorGapKeyword[] = [],
): CompetitorGaps => ({
  theyRankYouDont: [],
  youRankTheyDont: [],
  outranked: [],
  keywordGaps: winnable,
  winnable,
  threats,
  lead: [],
  coverage: {
    competitors: 1,
    delisted: 0,
    markets: [
      { country: "de", keywords: 1, compared: 1 },
      { country: "us", keywords: 5, compared: 5 },
    ],
  },
});

const textOf = (given: CompetitorGaps, country = "") =>
  headlineText(
    gapHeadline(given, { competitors: [RIVAL], country, home: "us" }),
  );

const many = (count: number, over: Partial<CompetitorGapKeyword> = {}) =>
  Array.from({ length: count }, (_, index) =>
    row({ keywordId: `kw-${index}`, ...over }),
  );

describe("gapHeadline", () => {
  it("names the biggest winnable gap and the threats", () => {
    expect(textOf(gaps([row(), ...many(3)], many(20)))).toBe(
      "4 winnable gaps. Biggest: productivity app, Rival Focus ranks #8, you are not ranked. 20 threats.",
    );
  });

  it("writes one gap and one threat in the singular", () => {
    expect(textOf(gaps([row()], many(1)))).toBe(
      "1 winnable gap. Biggest: productivity app, Rival Focus ranks #8, you are not ranked. 1 threat.",
    );
  });

  it("names the position of an app ranked below the gap line", () => {
    expect(textOf(gaps([row({ yourPosition: 150 })]))).toBe(
      "1 winnable gap. Biggest: productivity app, Rival Focus ranks #8, you are at #150.",
    );
  });

  it.each([
    ["an unknown competitor", "comp-9"],
    ["no competitor id", null],
  ])("names %s as a competitor", (_, bestCompetitorId) => {
    expect(textOf(gaps([row({ bestCompetitorId })]))).toContain(
      "a competitor ranks #8",
    );
  });

  it("counts threats without a winnable gap", () => {
    expect(textOf(gaps([], many(2)))).toBe("No winnable gaps. 2 threats.");
  });

  it("says when there is nothing to win or defend", () => {
    expect(textOf(gaps([]))).toBe("No winnable gaps or threats right now.");
  });

  it("counts only the market in scope", () => {
    expect(
      textOf(gaps([row()], [row({ country: "de", keywordId: "kw-de" })]), "de"),
    ).toBe("No winnable gaps. 1 threat.");
  });

  it.each([
    [
      { competitors: 0, delisted: 0, markets: [] },
      "Add a competitor to see gaps.",
    ],
    [
      { competitors: 0, delisted: 2, markets: [] },
      "Every competitor you track is delisted.",
    ],
    [
      {
        competitors: 1,
        delisted: 0,
        markets: [{ country: "us", keywords: 3, compared: 0 }],
      },
      "Your competitors have not been checked yet.",
    ],
  ])("says why nothing can be compared", (coverage, text) => {
    expect(textOf({ ...gaps([row()]), coverage })).toBe(text);
  });
});

describe("headlineLink", () => {
  const scope = { competitors: [RIVAL], country: "", home: "us" };

  it("links the biggest winnable gap to its breakdown", () => {
    expect(
      headlineLink("app-1", gapHeadline(gaps([row()]), scope), ""),
    ).toEqual({
      label: "See the winnable gaps",
      href: "/apps/app-1/competitors?gaps=winnable&keyword=kw-4",
    });
  });

  it("keeps the market the overview looks at", () => {
    const german = row({ country: "de", keywordId: "kw-de" });

    expect(
      headlineLink(
        "app-1",
        gapHeadline(gaps([], [german]), { ...scope, country: "de" }),
        "de",
      ),
    ).toEqual({
      label: "See the threats",
      href: "/apps/app-1/competitors?gaps=threats&gapCountry=de",
    });
  });

  it("links an app without competitors to the add form", () => {
    expect(
      headlineLink(
        "app-2",
        gapHeadline(
          {
            ...gaps([]),
            coverage: { competitors: 0, delisted: 0, markets: [] },
          },
          scope,
        ),
        "",
      ),
    ).toEqual({
      label: "Add a competitor",
      href: "/apps/app-2/competitors#competitor-search",
    });
  });

  it("links nothing when there is nothing to act on", () => {
    expect(headlineLink("app-1", gapHeadline(gaps([]), scope), "")).toBeNull();
  });
});
