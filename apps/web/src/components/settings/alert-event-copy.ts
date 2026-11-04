import {
  normalizeReviewScores,
  ratingDropLabel,
  reviewScoresLabel,
  type WebhookEvent,
} from "@asobeast/shared";

export const EVENT_LABELS: Record<WebhookEvent, string> = {
  "metadata.changed": "Metadata changed",
  "rank.dropped": "Rank dropped",
  "rank.improved": "Rank improved",
  "rank.milestone": "Rank milestone",
  "rank.first": "First ranking",
  "rank.overtaken": "Overtaken by competitor",
  "review.new": "New review",
  "review.negative": "Negative review",
  "rating.dropped": "Rating dropped",
  "review.spike": "Review spike",
  "digest.weekly": "Weekly digest",
  "serp.entrant": "SERP entrant",
  "action.opened": "New action",
  "chart.entered": "Chart entered",
  "chart.left": "Chart left",
  "chart.milestone": "Chart milestone",
};

export const PICKER_EVENTS: readonly WebhookEvent[] = [
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
];

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
