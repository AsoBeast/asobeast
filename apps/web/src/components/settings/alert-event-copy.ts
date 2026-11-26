import {
  ESSENTIAL_ALERT_EVENTS,
  REVIEW_SCORES,
  normalizeReviewScores,
  selectedReviewScores,
  type WebhookEvent,
} from "@asobeast/shared";
import type { TranslationContext } from "@/i18n/translator";
import { formatListInLocale } from "@/lib/format";
import enNotifications from "../../../messages/en/notifications.json";
import { ALERT_RULE_ORDER, ALERT_RULES } from "./alert-rules";
import { thresholdBadge } from "./alert-thresholds";

const englishRules = enNotifications.rules.events as Record<
  string,
  { title: string }
>;

export const EVENT_LABELS = Object.fromEntries(
  ALERT_RULE_ORDER.map((event) => [
    event,
    englishRules[ALERT_RULES[event].catalogKey].title,
  ]),
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

export function eventLabel(
  event: WebhookEvent,
  translator: TranslationContext["translator"],
): string {
  return translator(`rules.events.${ALERT_RULES[event].catalogKey}.title`);
}

function reviewScoresBadge(
  reviewScores: readonly number[],
  context: TranslationContext,
): string | null {
  const selected = selectedReviewScores(reviewScores);
  if (selected.length === REVIEW_SCORES.length) return null;
  const first = selected[0];
  const last = selected[selected.length - 1];
  if (selected.length === 1) {
    return context.translator("reviewStars.single", { score: first });
  }
  if (selected.length >= 3 && last - first + 1 === selected.length) {
    return context.translator("reviewStars.range", {
      first,
      last,
      count: selected.length,
    });
  }
  return context.translator("reviewStars.filtered", {
    scores: formatListInLocale(selected.map(String), context.locale),
    count: selected.length,
  });
}

export function eventBadgeLabel(
  event: WebhookEvent,
  reviewScores: readonly number[] | undefined,
  thresholds: ChannelThresholds = {},
  context: TranslationContext,
): string {
  if (event === "review.new" && reviewScores && reviewScores.length > 0) {
    const detail = reviewScoresBadge(reviewScores, context);
    if (detail !== null) {
      return context.translator("eventWithDetail", {
        event: eventLabel(event, context.translator),
        detail,
      });
    }
  }
  if (event === "rating.dropped" && thresholds.ratingDropTenths !== undefined) {
    return thresholdBadge(
      event,
      thresholds.ratingDropTenths,
      context.translator,
    );
  }
  if (
    event === "rank.dropped" &&
    typeof thresholds.rankDropThreshold === "number"
  ) {
    return thresholdBadge(
      event,
      thresholds.rankDropThreshold,
      context.translator,
    );
  }
  return eventLabel(event, context.translator);
}
