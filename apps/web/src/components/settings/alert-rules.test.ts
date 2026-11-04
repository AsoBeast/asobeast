import { describe, expect, it } from "vitest";
import { ESSENTIAL_ALERT_EVENTS, WEBHOOK_EVENTS } from "@asobeast/shared";
import {
  ALERT_RULE_GROUPS,
  ALERT_RULE_ORDER,
  ALERT_RULES,
} from "./alert-rules";

const DASH = /[–—]| - /;

describe("ALERT_RULES", () => {
  it("describes every event", () => {
    expect(Object.keys(ALERT_RULES).sort()).toEqual([...WEBHOOK_EVENTS].sort());
  });

  it("orders every event once", () => {
    expect([...ALERT_RULE_ORDER].sort()).toEqual([...WEBHOOK_EVENTS].sort());
    expect(new Set(ALERT_RULE_ORDER).size).toBe(ALERT_RULE_ORDER.length);
  });

  it("titles and details every rule without dash punctuation", () => {
    for (const rule of Object.values(ALERT_RULES)) {
      expect(rule.title.length).toBeGreaterThan(0);
      expect(rule.detail.length).toBeGreaterThan(0);
      expect(ALERT_RULE_GROUPS).toContain(rule.group);
      expect(rule.title).not.toMatch(DASH);
      expect(rule.detail).not.toMatch(DASH);
    }
  });

  it("gives an inline control only to the rules that take one", () => {
    const controlled = Object.entries(ALERT_RULES)
      .filter(([, rule]) => rule.control !== "none")
      .map(([event, rule]) => [event, rule.control]);

    expect(Object.fromEntries(controlled)).toEqual({
      "rank.dropped": "rank-threshold",
      "rank.improved": "rank-follows",
      "rating.dropped": "rating-tenths",
      "review.new": "review-stars",
    });
  });

  it("describes every essential event", () => {
    for (const event of ESSENTIAL_ALERT_EVENTS) {
      expect(ALERT_RULES[event]).toBeDefined();
    }
  });
});
