import type { ChangeImpactItem, ChangeImpactReport } from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enChanges from "../../../messages/en/changes.json";
import type { MessageTranslator } from "@/i18n/translator";
import {
  formatDayMonthInLocale,
  formatMeasureFixedInLocale,
} from "@/lib/format";
import type { Locale } from "@/lib/locale";

const english = createTranslator({
  locale: "en",
  namespace: "changes",
  messages: { changes: enChanges },
});

export type ChangeEffect =
  | { kind: "measured"; days: number; change: number }
  | { kind: "pending"; measurableOn: string };

export function changeEffect(item: ChangeImpactItem): ChangeEffect | null {
  const windows = [...item.windows].sort((a, b) => a.days - b.days);
  for (const window of windows) {
    if (window.status === "measured" && window.visibilityChange !== null) {
      return {
        kind: "measured",
        days: window.days,
        change: window.visibilityChange,
      };
    }
  }
  const pending = windows.find((window) => window.status === "pending");
  return pending && item.baselineDate !== null
    ? { kind: "pending", measurableOn: pending.targetDate }
    : null;
}

export function effectsByDay(
  report: ChangeImpactReport,
): Map<string, ChangeEffect> {
  const byDay = new Map<string, ChangeEffect>();
  for (const item of report.items) {
    const effect = changeEffect(item);
    if (effect) byDay.set(item.changedOn, effect);
  }
  return byDay;
}

export function visibilityMove(
  change: number,
  t: MessageTranslator = english,
  locale: Locale = "en",
): string {
  if (change === 0) return t("effect.unchanged");
  return t(change > 0 ? "effect.up" : "effect.down", {
    value: formatMeasureFixedInLocale(Math.abs(change), locale),
  });
}

export function effectLine(
  effect: ChangeEffect,
  t: MessageTranslator = english,
  locale: Locale = "en",
): string {
  return effect.kind === "pending"
    ? t("timeline.measurableOn", {
        date: formatDayMonthInLocale(effect.measurableOn, locale),
      })
    : t("effect.line", {
        move: visibilityMove(effect.change, t, locale),
        days: effect.days,
      });
}

export const impactAnchor = (day: string): string => `change-impact-${day}`;

export const timelineAnchor = (day: string): string => `changes-day-${day}`;
