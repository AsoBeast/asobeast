import { describe, expect, it } from "vitest";
import { ESSENTIAL_ALERT_EVENTS, WEBHOOK_EVENTS } from "@asobeast/shared";
import { translationContext } from "@/test/translation-context";
import {
  ALERT_RULE_GROUPS,
  ALERT_RULE_ORDER,
  ALERT_RULES,
  alertRuleCopy,
} from "./alert-rules";

const en = translationContext("en", "notifications").translator;
const zh = translationContext("zh-CN", "notifications").translator;

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
      const copy = alertRuleCopy(rule, en);
      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.detail.length).toBeGreaterThan(0);
      expect(ALERT_RULE_GROUPS).toContain(rule.group);
      expect(copy.title).not.toMatch(DASH);
      expect(copy.detail).not.toMatch(DASH);
    }
  });

  it("localizes rule titles and details by stable event descriptor", () => {
    expect(alertRuleCopy(ALERT_RULES["rank.dropped"], zh)).toEqual({
      title: "排名下降",
      detail: "您的应用关键词排名至少下降指定名次。",
    });
    expect(alertRuleCopy(ALERT_RULES["app.delisted"], zh)).toEqual({
      title: "应用已下架",
      detail: "一个应用从其主应用商店消失。",
    });
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
