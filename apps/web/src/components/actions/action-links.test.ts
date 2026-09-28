import type { ActionRule } from "@asobeast/shared";
import { ACTION_RULES } from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import { actionHref, actionSection } from "./action-links";
import { actionItem } from "./action-test-item";

const HREF: Record<ActionRule, string> = {
  "keyword.add_uncovered": "/apps/app-1/metadata?keyword=kw-1",
  "keyword.defend": "/apps/app-1/keywords?country=us&serp=kw-1",
  "keyword.prune": "/apps/app-1/keywords?country=us&sort=position",
  "rank.investigate_drop": "/apps/app-1/changes",
  "serp.hold_volatile": "/apps/app-1/keywords?country=us&sort=volatility",
  "audit.fix_factor": "/apps/app-1/audit",
  "reviews.investigate_theme": "/apps/app-1/reviews?score=1",
  "market.improve_country": "/apps/app-1/keywords?country=us",
  "keyword.push_to_top10": "/apps/app-1/metadata?keyword=kw-1",
  "metadata.fix_lint": "/apps/app-1/metadata",
};

describe("actionHref", () => {
  it.each(ACTION_RULES.map((rule) => [rule, HREF[rule]] as const))(
    "links %s to %s",
    (rule, href) => {
      expect(actionHref(actionItem({ rule }))).toBe(href);
    },
  );

  it("drops the keyword parameters when the action has no keyword", () => {
    const scope = { keywordId: null, keywordText: null };

    expect(actionHref(actionItem({ scope }))).toBe("/apps/app-1/metadata");
    expect(actionHref(actionItem({ rule: "keyword.defend", scope }))).toBe(
      "/apps/app-1/keywords?country=us",
    );
  });
});

describe("actionSection", () => {
  it("names the section a link opens", () => {
    expect(actionSection("/apps/app-1/metadata?keyword=kw-1")).toBe("Metadata");
    expect(actionSection("/apps/app-1/reviews?score=1")).toBe("Reviews");
  });

  it("falls back to the app for an unknown section", () => {
    expect(actionSection("/apps/app-1/setup")).toBe("the app");
  });
});
