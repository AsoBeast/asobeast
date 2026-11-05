import type { WebhookEvent } from "@asobeast/shared";

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
  title: string;
  detail: string;
  group: AlertRuleGroup;
  control: RuleControl;
}

const rule = (
  title: string,
  group: AlertRuleGroup,
  detail: string,
  control: RuleControl = "none",
): AlertRule => ({ title, detail, group, control });

export const ALERT_RULES: Record<WebhookEvent, AlertRule> = {
  "metadata.changed": rule(
    "Metadata changed",
    "Listings",
    "A listing changes, yours or a competitor's.",
  ),
  "rank.dropped": rule(
    "Rank dropped",
    "Rankings",
    "A keyword of your app falls by at least this many positions.",
    "rank-threshold",
  ),
  "rank.improved": rule(
    "Rank improved",
    "Rankings",
    "A keyword climbs by at least the same number of positions.",
    "rank-follows",
  ),
  "rank.milestone": rule(
    "Rank milestone",
    "Rankings",
    "Your app enters or leaves the top 10, the top 3 or first place for a keyword.",
  ),
  "rank.first": rule(
    "First ranking",
    "Rankings",
    "Your app ranks for a keyword for the first time.",
  ),
  "rank.overtaken": rule(
    "Overtaken by competitor",
    "Rankings",
    "A competitor moves above your app for a keyword.",
  ),
  "review.new": rule(
    "New review",
    "Reviews and ratings",
    "Every new review, for the stars you pick.",
    "review-stars",
  ),
  "review.negative": rule(
    "Negative review",
    "Reviews and ratings",
    "A low review, at or below the cutoff the instance sets (2 stars by default).",
  ),
  "rating.dropped": rule(
    "Rating dropped",
    "Reviews and ratings",
    "The average rating falls by at least this many tenths of a star within a week.",
    "rating-tenths",
  ),
  "review.spike": rule(
    "Review spike",
    "Reviews and ratings",
    "An unusual number of new reviews arrives in one day.",
  ),
  "digest.weekly": rule(
    "Weekly digest",
    "Reports",
    "A weekly summary of your portfolio.",
  ),
  "serp.entrant": rule(
    "SERP entrant",
    "Rankings",
    "A new app enters the top 10 of a keyword you track.",
  ),
  "action.opened": rule(
    "New action",
    "Reports",
    "The Action Center opens or reopens an action at the priority the instance sets (high by default).",
  ),
  "chart.entered": rule(
    "Chart entered",
    "Charts",
    "Your app enters a store chart.",
  ),
  "chart.left": rule("Chart left", "Charts", "Your app leaves a store chart."),
  "chart.milestone": rule(
    "Chart milestone",
    "Charts",
    "Your app enters or leaves first place, the top 3 or the top 10 of a chart.",
  ),
  "app.delisted": rule(
    "App delisted",
    "Listings",
    "An app disappears from its home store.",
  ),
  "app.unlisted_market": rule(
    "Unlisted in a market",
    "Listings",
    "A store stops listing an app in one market.",
  ),
};

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
