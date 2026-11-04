import {
  normalizeReviewScores,
  ratingDropLabel,
  reviewScoresLabel,
  type WebhookEvent,
} from "@asobeast/shared";
import { ALERT_RULE_ORDER, ALERT_RULES } from "./alert-rules";

export const EVENT_LABELS = Object.fromEntries(
  ALERT_RULE_ORDER.map((event) => [event, ALERT_RULES[event].title]),
) as Record<WebhookEvent, string>;

export const PICKER_EVENTS = ALERT_RULE_ORDER;

export interface AlertSubscriptionChange {
  events: WebhookEvent[];
  reviewScores?: number[];
  confirmDrops?: boolean;
  ratingDropTenths?: number;
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

export function eventBadgeLabel(
  event: WebhookEvent,
  reviewScores: readonly number[] | undefined,
  ratingDropTenths?: number,
): string {
  if (event === "review.new" && reviewScores && reviewScores.length > 0) {
    return `${EVENT_LABELS[event]} · ${reviewScoresLabel(reviewScores)}`;
  }
  if (event === "rating.dropped" && ratingDropTenths !== undefined) {
    return `${EVENT_LABELS[event]} · ${ratingDropLabel(ratingDropTenths)}`;
  }
  return EVENT_LABELS[event];
}
