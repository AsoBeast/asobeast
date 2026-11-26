import {
  RANK_DROP_THRESHOLD_MAX,
  RANK_DROP_THRESHOLD_MIN,
  type WebhookEvent,
} from "@asobeast/shared";
import type { MessageTranslator } from "@/i18n/translator";
import { ALERT_RULES } from "./alert-rules";

export interface ParsedThreshold {
  value: number | null;
  error: string | null;
}

function parseRankDropValue(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  const valid =
    /^\d+$/.test(trimmed) &&
    value >= RANK_DROP_THRESHOLD_MIN &&
    value <= RANK_DROP_THRESHOLD_MAX;
  return valid ? value : null;
}

export function parseRankDropThreshold(
  text: string,
  translator: MessageTranslator,
): ParsedThreshold {
  const value = parseRankDropValue(text);
  return {
    value,
    error:
      value === null && text.trim() !== ""
        ? translator("notifications.rankThreshold", {
            min: RANK_DROP_THRESHOLD_MIN,
            max: RANK_DROP_THRESHOLD_MAX,
          })
        : null,
  };
}

export function rankThresholdError(
  events: readonly WebhookEvent[],
  text: string,
  translator: MessageTranslator,
): string | null {
  return events.includes("rank.dropped")
    ? parseRankDropThreshold(text, translator).error
    : null;
}

export function rankThresholdToSend(
  events: readonly WebhookEvent[],
  text: string,
): number | undefined {
  if (!events.includes("rank.dropped")) return undefined;
  return parseRankDropValue(text) ?? undefined;
}

export function ratingDropOption(
  tenths: number,
  translator: MessageTranslator,
): string {
  return translator("ratingDrop.option", { stars: tenths / 10, tenths });
}

export function thresholdBadge(
  event: WebhookEvent,
  value: number,
  translator: MessageTranslator,
): string {
  const title = translator(
    `rules.events.${ALERT_RULES[event].catalogKey}.title`,
  );
  const detail =
    event === "rating.dropped"
      ? ratingDropOption(value, translator)
      : translator("rules.rankThresholdValue", { value });
  return translator("eventWithDetail", { event: title, detail });
}

export const rankTextOf = (threshold: number | null): string =>
  threshold === null ? "" : String(threshold);

export function rankThresholdChange(
  events: readonly WebhookEvent[],
  text: string,
  saved: number | null,
): { rankDropThreshold?: number | null } {
  if (!events.includes("rank.dropped")) return {};
  const value = parseRankDropValue(text);
  return value === saved ? {} : { rankDropThreshold: value };
}
