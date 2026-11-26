import enMetrics from "../../messages/en/metrics.json";
import { formatMessage } from "@/i18n/format-message";
import type { MessageTranslator } from "@/i18n/translator";

const UTILIZATION_WARN = 0.6;
const UTILIZATION_DANGER = 0.85;

const FULL = 1;
const PERCENT_MAX = 100;

export type UtilizationLevel = "ok" | "warn" | "danger";

const ENGLISH_MESSAGES: Readonly<Record<string, string>> = {
  percent: enMetrics.percent,
  "status.healthy": enMetrics.status.healthy,
  "status.high": enMetrics.status.high,
  "status.nearCapacity": enMetrics.status.nearCapacity,
  "status.overCapacity": enMetrics.status.overCapacity,
};

const englishTranslator: MessageTranslator = (key, values) =>
  formatMessage(ENGLISH_MESSAGES[key] ?? key, "en", values);

export function utilizationLevel(utilization: number): UtilizationLevel {
  if (utilization > UTILIZATION_DANGER) return "danger";
  if (utilization > UTILIZATION_WARN) return "warn";
  return "ok";
}

export function utilizationStatus(
  utilization: number,
  translator: MessageTranslator = englishTranslator,
): string {
  if (utilization > FULL) return translator("status.overCapacity");
  const level = utilizationLevel(utilization);
  if (level === "danger") return translator("status.nearCapacity");
  return translator(level === "warn" ? "status.high" : "status.healthy");
}

export function utilizationPercent(utilization: number): number {
  return Math.round(utilization * 100);
}

export function meterValue(
  utilization: number,
  translator: MessageTranslator = englishTranslator,
): { now: number; text: string } {
  const percent = utilizationPercent(utilization);
  return {
    now: Math.min(PERCENT_MAX, percent),
    text: translator("percent", { value: percent }),
  };
}
