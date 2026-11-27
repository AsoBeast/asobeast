import { describe, expect, it } from "vitest";
import type { WebhookEvent } from "@asobeast/shared";
import { translationContext } from "@/test/translation-context";
import { ALERT_RULE_GROUPS } from "./alert-rules";
import { groupedRules, ruleSummary, toggleRule } from "./alert-rules-state";

const en = translationContext("en", "notifications").translator;
const zh = translationContext("zh-CN", "notifications").translator;

describe("toggleRule", () => {
  it("adds a rule in table order, not in click order", () => {
    expect(toggleRule(["rank.first"], "metadata.changed")).toEqual([
      "metadata.changed",
      "rank.first",
    ]);
  });

  it("removes a rule that is on", () => {
    expect(
      toggleRule(["metadata.changed", "rank.first"], "rank.first"),
    ).toEqual(["metadata.changed"]);
  });
});

describe("groupedRules", () => {
  it("answers the five groups with each rule switched on or off", () => {
    const groups = groupedRules(["rank.dropped"]);

    expect(groups.map((entry) => entry.group)).toEqual([...ALERT_RULE_GROUPS]);
    const rankings = groups[0].rules;
    expect(rankings.find((entry) => entry.event === "rank.dropped")?.on).toBe(
      true,
    );
    expect(rankings.find((entry) => entry.event === "rank.first")?.on).toBe(
      false,
    );
  });
});

describe("ruleSummary", () => {
  it("counts only the rules the table knows", () => {
    expect(
      ruleSummary(["rank.dropped", "unknown.event" as WebhookEvent], en),
    ).toBe("1 rule on");
    expect(ruleSummary(["rank.dropped", "rank.first"], en)).toBe("2 rules on");
  });

  it("counts enabled rules in Chinese", () => {
    expect(ruleSummary(["rank.dropped"], zh)).toBe("已开启 1 条规则");
    expect(ruleSummary(["rank.dropped", "rank.first"], zh)).toBe(
      "已开启 2 条规则",
    );
  });
});
