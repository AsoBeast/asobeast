import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import zhAudit from "../../../messages/zh-CN/audit.json";
import type {
  AuditCheckSource,
  AuditCheckStatus,
  AuditEffort,
  AuditFactorAvailability,
  AuditImpact,
  AuditScreenshotMessage,
  AuditTarget,
} from "@asobeast/shared";
import {
  availabilityLabel,
  emptyBucketLine,
  fixesWorth,
  liftFigure,
  liftLabel,
  provisional,
  measuredLine,
  scoredFactorsLine,
  scoreRingLabel,
} from "./audit-copy";

const zh = createTranslator({
  locale: "zh-CN",
  namespace: "audit",
  messages: { audit: zhAudit },
});

const SOURCES = [
  "store",
  "keywords",
  "competitors",
  "reviews",
  "rankings",
  "ai",
] as const satisfies readonly AuditCheckSource[];

const STATUSES = [
  "pass",
  "warn",
  "fail",
  "unanswered",
] as const satisfies readonly AuditCheckStatus[];

const EFFORTS = [
  "minutes",
  "hours",
  "weeks",
] as const satisfies readonly AuditEffort[];

const IMPACTS = [
  "high",
  "medium",
  "low",
] as const satisfies readonly AuditImpact[];

const TARGETS = [
  "metadata",
  "keywords",
  "competitors",
  "reviews",
  "rankings",
  "store-console",
  "ai-analysis",
] as const satisfies readonly AuditTarget[];

const MESSAGES = [
  "benefit",
  "feature",
  "social-proof",
  "ui-only",
  "onboarding",
  "other",
] as const satisfies readonly AuditScreenshotMessage[];

const AVAILABILITIES = [
  "measured",
  "partial",
  "awaiting-input",
  "not-measurable",
] as const satisfies readonly AuditFactorAvailability[];

describe("label maps", () => {
  it.each([
    ["sources", SOURCES],
    ["statuses", STATUSES],
    ["efforts", EFFORTS],
    ["impacts", IMPACTS],
    ["targets", TARGETS],
    ["messages", MESSAGES],
  ] as const)("names every %s in Chinese", (namespace, members) => {
    for (const member of members) {
      const key = `${namespace}.${member}` as Parameters<typeof zh>[0];
      expect(zh(key)).not.toBe("");
    }
  });

  it("names every availability that needs a line", () => {
    for (const availability of AVAILABILITIES) {
      const label = availabilityLabel(availability, "APP_STORE");
      const needsLabel =
        availability === "not-measurable" || availability === "awaiting-input";
      expect(label === null).toBe(!needsLabel);
    }
  });
});

describe("provisional", () => {
  it.each([
    [0.59, true],
    [0.6, false],
    [undefined, false],
  ])("treats confidence %s as provisional: %s", (confidence, expected) => {
    expect(provisional(confidence)).toBe(expected);
  });
});

describe("emptyBucketLine", () => {
  it("never praises an empty bucket that could still grow", () => {
    expect(emptyBucketLine(0)).toBe("Nothing to change here.");
    expect(emptyBucketLine(9)).toContain("this list may grow");
    expect(emptyBucketLine(9)).not.toMatch(/great work/i);
  });

  it("agrees the verb with one unscored check", () => {
    expect(emptyBucketLine(1)).toBe(
      "Nothing yet. 1 check is not scored, so this list may grow.",
    );
    expect(emptyBucketLine(9)).toContain("9 checks are not scored");
  });
});

describe("liftLabel", () => {
  it("shows a measured lift in points", () => {
    expect(liftLabel(4.5)).toBe("+4.5 points");
    expect(liftLabel(0)).toBe("+0 points");
  });

  it("never presents a lift an older API did not send as zero", () => {
    expect(liftLabel(undefined)).toBe("Lift not estimated");
  });
});

describe("scoreRingLabel", () => {
  it("reads the score, the grade and the measured share", () => {
    expect(scoreRingLabel(71.8, "B", 0.82)).toBe(
      "ASO score 72 out of 100, grade B, Good, 82% measured",
    );
  });

  it("leaves the measured share out when an older API does not send it", () => {
    expect(scoreRingLabel(71.8, "B", undefined)).toBe(
      "ASO score 72 out of 100, grade B, Good",
    );
    expect(measuredLine(undefined)).toBeNull();
    expect(measuredLine(0.82)).toBe("82% of the rubric measured");
  });

  it("says nothing is scored yet without an overall", () => {
    expect(scoreRingLabel(null, null, undefined)).toBe(
      "ASO score not available yet",
    );
  });
});

describe("fixesWorth", () => {
  it("totals the estimated lifts to one decimal", () => {
    expect(fixesWorth([{ lift: 4.2 }, { lift: 3.4 }, { lift: 2.1 }])).toBe(
      "+9.7 points",
    );
  });

  it("leaves out a fix without an estimate", () => {
    expect(fixesWorth([{ lift: 4.2 }, {}])).toBe("+4.2 points");
  });

  it("has no total when nothing is estimated", () => {
    expect(fixesWorth([{}, {}])).toBeNull();
    expect(fixesWorth([])).toBeNull();
  });
});

describe("liftFigure", () => {
  it("writes the lift with its sign, or a dash without an estimate", () => {
    expect(liftFigure(4.2)).toBe("+4.2");
    expect(liftFigure(undefined)).toBe("—");
  });
});

describe("scoredFactorsLine", () => {
  it("counts the factors, and how many of them are scored", () => {
    expect(scoredFactorsLine(6, 6)).toBe("6 factors scored");
    expect(scoredFactorsLine(1, 1)).toBe("1 factor scored");
    expect(scoredFactorsLine(3, 4)).toBe("3 of 4 factors scored");
    expect(scoredFactorsLine(0, 1)).toBe("0 of 1 factor scored");
  });

  it("writes generated labels in Simplified Chinese", () => {
    expect(liftLabel(4.5, zh)).toBe("+4.5 分");
    expect(emptyBucketLine(1, zh)).toContain("1 项检查尚未评分");
    expect(measuredLine(0.82, zh)).toBe("已衡量评分规则的 82%");
    expect(scoreRingLabel(72, "B", 0.82, zh)).toContain("等级 B，良好");
    expect(fixesWorth([{ lift: 4.2 }, { lift: 3.4 }], zh)).toBe("+7.6 分");
    expect(scoredFactorsLine(3, 4, zh)).toBe("已评分 4 个因素中的 3 个");
  });
});
