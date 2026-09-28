import type {
  ActionEvidence,
  KeywordDefendEvidence,
  RankInvestigateDropEvidence,
  ReviewsInvestigateThemeEvidence,
} from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import { ACTIONS } from "../../../e2e/fixtures.mts";
import { actionHeadline, changedFields } from "./action-headline";
import { actionItem } from "./action-test-item";

const headline = (
  evidence: ActionEvidence,
  keywordText: string | null = "habit tracker",
) =>
  actionHeadline(
    actionItem({
      rule: evidence.rule,
      evidence,
      degraded: false,
      scope: { keywordText },
    }),
  );

describe("actionHeadline", () => {
  it("names the keyword to add", () => {
    expect(
      headline({
        rule: "keyword.add_uncovered",
        opportunity: 66.5,
        traffic: null,
        difficulty: null,
        volume: 62,
        relevance: 80,
        latestPosition: null,
        indexedFields: ["title"],
        uncoveredFields: ["title"],
        keywordFieldCharsFree: null,
        scoreProvenance: null,
      }),
    ).toBe('Add "habit tracker" to your metadata');
  });

  it("counts the entrants of a defended keyword, or states the goal without them", () => {
    const defend: Omit<KeywordDefendEvidence, "entrants"> = {
      rule: "keyword.defend",
      yourPosition: 6,
      previousPosition: 4,
      windowDays: 7,
      observedDays: 6,
      volatility: null,
      entrantsAtOrAbove: 1,
      volume: 55,
    };
    const entrant = {
      storeAppId: "1",
      title: "Rival",
      position: 3,
      appId: null,
      isCompetitor: false,
    };

    expect(headline({ ...defend, entrants: [entrant, entrant] })).toBe(
      'Defend "habit tracker": 2 new apps in the top 10',
    );
    expect(headline({ ...defend, entrants: [entrant] })).toBe(
      'Defend "habit tracker": 1 new app in the top 10',
    );
    expect(headline({ ...defend, entrants: [] })).toBe(
      'Defend "habit tracker" in the top 10',
    );
  });

  it("states how rarely a pruned keyword ranked", () => {
    expect(
      headline({
        rule: "keyword.prune",
        observedDays: 40,
        checkedDays: 40,
        rankedDays: 0,
        bestPosition: null,
        volume: 4,
        traffic: null,
        relevance: 20,
        dailyRequestsSaved: 1,
        budgetUtilization: 0.6,
      }),
    ).toBe('Retire "habit tracker": ranked on 0 of 40 days');
  });

  it("names the drop and the fields that changed", () => {
    const drop: Omit<RankInvestigateDropEvidence, "visibilityDelta"> = {
      rule: "rank.investigate_drop",
      changedAt: "2026-07-25",
      fields: ["title", "subtitle"],
      visibilityBefore: 52,
      visibilityAfter: 41.3,
      windowDays: 7,
      trackedKeywords: 12,
      droppedKeywords: [{ keywordId: "kw-1", text: "habit", from: 4, to: 9 }],
      meanVolatility: null,
    };

    expect(headline({ ...drop, visibilityDelta: -10.7 }, null)).toBe(
      "Investigate the 10.7 point drop after your title and subtitle change",
    );
    expect(headline({ ...drop, visibilityDelta: null }, null)).toBe(
      "Investigate 1 keyword drop after your title and subtitle change",
    );
  });

  it("asks to hold a volatile keyword", () => {
    expect(
      headline({
        rule: "serp.hold_volatile",
        volatility: 61,
        windowDays: 7,
        observedDays: 7,
        yourPosition: 5,
        dampenedRules: [],
      }),
    ).toBe('Hold changes on "habit tracker" while its results are volatile');
  });

  it("names the audit factor and its score", () => {
    expect(
      headline(
        {
          rule: "audit.fix_factor",
          factorId: "screenshots",
          factorLabel: "Screenshots",
          score: 3,
          weight: 15,
          overall: 61,
          coveredWeight: 85,
          totalWeight: 100,
          auditDate: "2026-07-29",
          failingChecks: [],
        },
        null,
      ),
    ).toBe("Raise Screenshots from 3 of 10");
  });

  it("names the review theme and its version", () => {
    const theme: Omit<ReviewsInvestigateThemeEvidence, "version"> = {
      rule: "reviews.investigate_theme",
      theme: "crashes on launch",
      previousVersion: null,
      mentions: 9,
      previousMentions: 1,
      negativeReviews: 22,
      totalReviews: 61,
      ratingAvgDelta: null,
      sampleReviewIds: [],
    };

    expect(headline({ ...theme, version: "4.2.0" }, null)).toBe(
      'Look into "crashes on launch" in reviews of 4.2.0',
    );
    expect(headline({ ...theme, version: null }, null)).toBe(
      'Look into "crashes on launch" in reviews of the latest version',
    );
  });

  it("names the market by its country name", () => {
    expect(
      headline(
        {
          rule: "market.improve_country",
          country: "de",
          homeCountry: "us",
          marketVisibility: 12,
          homeVisibility: 38.5,
          gap: 26.5,
          trackedKeywords: 8,
          rankedKeywords: 2,
          observedDays: 14,
          windowDays: 14,
        },
        null,
      ),
    ).toBe("Close the 26.5 point visibility gap in Germany");
  });

  it("names the position a keyword near the top 10 starts from", () => {
    expect(
      headline({
        rule: "keyword.push_to_top10",
        latestPosition: 12,
        bestPosition: 11,
        daysInBand: 6,
        windowDays: 7,
        volume: 54,
        relevance: 80,
        opportunity: 41.5,
        coveredFields: ["keywordField"],
        strongFields: ["title", "subtitle"],
      }),
    ).toBe('Push "habit tracker" from #12 into the top 10');
  });

  it("names the visibility drop that followed no change, or the keywords when it is small", () => {
    const slide = {
      rule: "rank.investigate_unexplained_drop" as const,
      country: "de",
      visibilityBefore: 40,
      visibilityAfter: 32.5,
      visibilityDelta: 7.5,
      windowDays: 14,
      trackedKeywords: 5,
      droppedKeywords: [
        { keywordId: "k1", text: "a", from: 4, to: 12 },
        { keywordId: "k2", text: "b", from: 6, to: null },
        { keywordId: "k3", text: "c", from: 9, to: 30 },
      ],
      meanVolatility: null,
      lastOwnChangeAt: null,
    };

    expect(headline(slide, null)).toBe(
      "Find out why visibility fell 7.5 points in Germany",
    );
    expect(
      headline({ ...slide, visibilityAfter: 39.6, visibilityDelta: 0.4 }, null),
    ).toBe("Find out why 3 keywords fell in Germany");
  });

  it("names the competitor, the fields it changed and the keywords it passed", () => {
    const overtake = {
      rule: "competitor.investigate_overtake" as const,
      competitorAppId: "comp-1",
      competitorName: "Tomato Focus",
      changedAt: "2026-07-24",
      fields: ["title" as const, "summary" as const],
      newTitle: "Tomato Focus",
      newSubtitle: null,
      keywords: [
        {
          keywordId: "k1",
          text: "a",
          yourBefore: 6,
          yourAfter: 9,
          theirBefore: 14,
          theirAfter: 4,
          volume: 60,
          mentioned: false,
        },
      ],
    };

    expect(headline(overtake, null)).toBe(
      "Tomato Focus changed its title and short description and passed you on 1 keyword",
    );
    expect(headline({ ...overtake, competitorName: null }, null)).toMatch(
      /^A competitor changed its/,
    );
  });

  it("names the fall in review scores and its window", () => {
    expect(
      headline(
        {
          rule: "reviews.investigate_rating_decline",
          recentAverage: 3.5,
          baselineAverage: 4.5,
          drop: 1,
          recentReviews: 8,
          baselineReviews: 6,
          recentDays: 14,
          baselineDays: 21,
          latestVersion: "4.2.0",
          negativeShare: 0.25,
          sampleReviewIds: [],
        },
        null,
      ),
    ).toBe("Review scores fell from 4.5 to 3.5 in the last 14 days");
  });

  it("counts the store rule problems in a listing field", () => {
    const issue = {
      rule: "over-limit",
      message: "Exceeds the 30 character limit (34).",
      offendingText: null,
    };
    const lint = {
      rule: "metadata.fix_lint" as const,
      field: "keywordField" as const,
      chars: 104,
      limit: 100,
      issues: [issue],
    };

    expect(headline(lint, null)).toBe(
      "Fix 1 store rule problem in your keyword field",
    );
    expect(headline({ ...lint, issues: [issue, issue] }, null)).toBe(
      "Fix 2 store rule problems in your keyword field",
    );
  });

  it("falls back to the rule title for degraded evidence", () => {
    expect(actionHeadline(actionItem({ scope: { keywordText: null } }))).toBe(
      "Add a high-opportunity keyword to your metadata",
    );
    expect(actionHeadline(actionItem())).toBe(
      'Add a high-opportunity keyword to your metadata: "habit tracker"',
    );
  });

  it("joins changed fields in words", () => {
    expect(changedFields(["summary"])).toBe("short description");
    expect(changedFields(["title", "summary", "description"])).toBe(
      "title, short description, and description",
    );
  });

  it("gives every open fixture action its own headline", () => {
    const open = ACTIONS.filter((item) => item.status === "OPEN");
    const headlines = open.map(actionHeadline);

    expect(new Set(headlines).size).toBe(open.length);
  });
});
