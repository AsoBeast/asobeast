import {
  RANK_DROP_THRESHOLD_MAX,
  RANK_DROP_THRESHOLD_MIN,
  ratingDropLabel,
  type WebhookEvent,
} from "@asobeast/shared";
import { ALERT_RULES } from "./alert-rules";

export const RANK_THRESHOLD_ERROR = `Enter a whole number from ${RANK_DROP_THRESHOLD_MIN} to ${RANK_DROP_THRESHOLD_MAX}`;

export interface ParsedThreshold {
  value: number | null;
  error: string | null;
}

export function parseRankDropThreshold(text: string): ParsedThreshold {
  const trimmed = text.trim();
  if (trimmed === "") return { value: null, error: null };
  const value = Number(trimmed);
  const valid =
    /^\d+$/.test(trimmed) &&
    value >= RANK_DROP_THRESHOLD_MIN &&
    value <= RANK_DROP_THRESHOLD_MAX;
  return valid
    ? { value, error: null }
    : { value: null, error: RANK_THRESHOLD_ERROR };
}

export function rankThresholdError(
  events: readonly WebhookEvent[],
  text: string,
): string | null {
  return events.includes("rank.dropped")
    ? parseRankDropThreshold(text).error
    : null;
}

export function rankThresholdToSend(
  events: readonly WebhookEvent[],
  text: string,
): number | undefined {
  if (!events.includes("rank.dropped")) return undefined;
  return parseRankDropThreshold(text).value ?? undefined;
}

export function thresholdBadge(event: WebhookEvent, value: number): string {
  const { title } = ALERT_RULES[event];
  return event === "rating.dropped"
    ? `${title} · ${ratingDropLabel(value)}`
    : `${title} · ${value}+`;
}

export const rankTextOf = (threshold: number | null): string =>
  threshold === null ? "" : String(threshold);

export function rankThresholdChange(
  events: readonly WebhookEvent[],
  text: string,
  saved: number | null,
): { rankDropThreshold?: number | null } {
  if (!events.includes("rank.dropped")) return {};
  const { value } = parseRankDropThreshold(text);
  return value === saved ? {} : { rankDropThreshold: value };
}
