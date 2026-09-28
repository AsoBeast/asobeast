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
