import {
  ESSENTIAL_ALERT_EVENTS,
  normalizeReviewScores,
  reviewScoresLabel,
  type WebhookEvent,
} from "@asobeast/shared";
import { ALERT_RULE_ORDER, ALERT_RULES } from "./alert-rules";
import { thresholdBadge } from "./alert-thresholds";

export const EVENT_LABELS = Object.fromEntries(
  ALERT_RULE_ORDER.map((event) => [event, ALERT_RULES[event].title]),
) as Record<WebhookEvent, string>;

export const PICKER_EVENTS = ALERT_RULE_ORDER;

export const DEFAULT_ALERT_EVENTS: readonly WebhookEvent[] = [
  ...ESSENTIAL_ALERT_EVENTS,
];

export const DEFAULT_RANK_TEXT = "10";

export interface AlertSubscriptionChange {
  events: WebhookEvent[];
  reviewScores?: number[];
  confirmDrops?: boolean;
  ratingDropTenths?: number;
  rankDropThreshold?: number | null;
}

export function reviewScoresToSend(
  events: readonly WebhookEvent[],
  ticked: readonly number[],
): number[] | undefined {
  return events.includes("review.new")
    ? normalizeReviewScores(ticked)
    : undefined;
}

export function ratingDropTenthsToSend(
  events: readonly WebhookEvent[],
  tenths: number,
): number | undefined {
  return events.includes("rating.dropped") ? tenths : undefined;
}

export function needsAStar(
  events: readonly WebhookEvent[],
  ticked: readonly number[],
): boolean {
  return events.includes("review.new") && ticked.length === 0;
}

export interface ChannelThresholds {
  ratingDropTenths?: number;
  rankDropThreshold?: number | null;
}

export function eventBadgeLabel(
  event: WebhookEvent,
  reviewScores: readonly number[] | undefined,
  thresholds: ChannelThresholds = {},
): string {
  if (event === "review.new" && reviewScores && reviewScores.length > 0) {
    return `${EVENT_LABELS[event]} · ${reviewScoresLabel(reviewScores)}`;
  }
  if (event === "rating.dropped" && thresholds.ratingDropTenths !== undefined) {
    return thresholdBadge(event, thresholds.ratingDropTenths);
  }
  if (
    event === "rank.dropped" &&
    typeof thresholds.rankDropThreshold === "number"
  ) {
    return thresholdBadge(event, thresholds.rankDropThreshold);
  }
  return EVENT_LABELS[event];
}
