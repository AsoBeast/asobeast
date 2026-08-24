import { ACTION_RULES } from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import {
  ACTION_RULE_LABEL,
  ACTION_RULE_TITLE,
  summarizeEvidence,
} from "./action-copy";

describe("summarizeEvidence", () => {
  it("rounds a stored score to one decimal", () => {
    const summary = summarizeEvidence({
      rule: "keyword.add_uncovered",
      opportunity: 60.24,
      traffic: null,
      volume: 45.43165338804846,
      difficulty: null,
      relevance: null,
      latestPosition: null,
      indexedFields: [],
      uncoveredFields: ["title"],
      keywordFieldCharsFree: null,
      scoreProvenance: null,
    });

    expect(summary).toBe(
      "Opportunity 60.2 with volume 45.4, and no indexed field contains it.",
    );
  });

  it("names a missing measure instead of printing null", () => {
    const summary = summarizeEvidence({
      rule: "keyword.add_uncovered",
      opportunity: 60,
      traffic: null,
      volume: null,
      difficulty: null,
      relevance: null,
      latestPosition: null,
      indexedFields: [],
      uncoveredFields: ["title"],
      keywordFieldCharsFree: null,
      scoreProvenance: null,
    });

    expect(summary).toContain("volume —");
  });
});

describe("ACTION_RULE_LABEL", () => {
  it("names every rule", () => {
    expect(Object.keys(ACTION_RULE_LABEL).sort()).toEqual(
      [...ACTION_RULES].sort(),
    );
  });

  it("reads as prose rather than as a rule identifier", () => {
    for (const rule of ACTION_RULES) {
      expect(ACTION_RULE_LABEL[rule]).not.toMatch(/[._]/);
      expect(ACTION_RULE_LABEL[rule]).not.toBe(ACTION_RULE_TITLE[rule]);
    }
  });
});
