import type { WebhookEvent } from "@asobeast/shared";
import type { MessageTranslator } from "@/i18n/translator";

export const ALERT_RULE_GROUPS = [
  "Rankings",
  "Charts",
  "Reviews and ratings",
  "Listings",
  "Reports",
] as const;
export type AlertRuleGroup = (typeof ALERT_RULE_GROUPS)[number];

export type RuleControl =
  "none" | "rank-threshold" | "rank-follows" | "rating-tenths" | "review-stars";

export interface AlertRule {
  catalogKey: string;
  group: AlertRuleGroup;
  control: RuleControl;
}

const rule = (
  catalogKey: string,
  group: AlertRuleGroup,
  control: RuleControl = "none",
): AlertRule => ({ catalogKey, group, control });

export const ALERT_RULES: Record<WebhookEvent, AlertRule> = {
  "metadata.changed": rule("metadataChanged", "Listings"),
  "rank.dropped": rule("rankDropped", "Rankings", "rank-threshold"),
  "rank.improved": rule("rankImproved", "Rankings", "rank-follows"),
  "rank.milestone": rule("rankMilestone", "Rankings"),
  "rank.first": rule("rankFirst", "Rankings"),
  "rank.overtaken": rule("rankOvertaken", "Rankings"),
  "review.new": rule("reviewNew", "Reviews and ratings", "review-stars"),
  "review.negative": rule("reviewNegative", "Reviews and ratings"),
  "rating.dropped": rule(
    "ratingDropped",
    "Reviews and ratings",
    "rating-tenths",
  ),
  "review.spike": rule("reviewSpike", "Reviews and ratings"),
  "digest.weekly": rule("digestWeekly", "Reports"),
  "serp.entrant": rule("serpEntrant", "Rankings"),
  "action.opened": rule("actionOpened", "Reports"),
  "chart.entered": rule("chartEntered", "Charts"),
  "chart.left": rule("chartLeft", "Charts"),
  "chart.milestone": rule("chartMilestone", "Charts"),
  "app.delisted": rule("appDelisted", "Listings"),
  "app.unlisted_market": rule("appUnlistedMarket", "Listings"),
};

export function alertRuleCopy(
  rule: AlertRule,
  translator: MessageTranslator,
): { title: string; detail: string } {
  return {
    title: translator(`rules.events.${rule.catalogKey}.title`),
    detail: translator(`rules.events.${rule.catalogKey}.detail`),
  };
}

const GROUP_KEYS: Record<AlertRuleGroup, string> = {
  Rankings: "rules.groups.rankings",
  Charts: "rules.groups.charts",
  "Reviews and ratings": "rules.groups.reviewsAndRatings",
  Listings: "rules.groups.listings",
  Reports: "rules.groups.reports",
};

export function alertRuleGroupLabel(
  group: AlertRuleGroup,
  translator: MessageTranslator,
): string {
  return translator(GROUP_KEYS[group]);
}

export const ALERT_RULE_ORDER: readonly WebhookEvent[] = [
  "metadata.changed",
  "rank.dropped",
  "rank.improved",
  "rank.milestone",
  "rank.first",
  "rank.overtaken",
  "review.new",
  "review.negative",
  "rating.dropped",
  "review.spike",
  "digest.weekly",
  "serp.entrant",
  "action.opened",
  "chart.entered",
  "chart.left",
  "chart.milestone",
  "app.delisted",
  "app.unlisted_market",
];
