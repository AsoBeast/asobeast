import type { ChangeImpactItem, ChangeImpactReport } from "@asobeast/shared";
import { formatDayMonth, formatMeasure } from "@/lib/format";

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

export function visibilityMove(change: number): string {
  if (change === 0) return "unchanged";
  return `${change > 0 ? "up" : "down"} ${formatMeasure(Math.abs(change))}`;
}

export function effectLine(effect: ChangeEffect): string {
  return effect.kind === "pending"
    ? `Measurable on ${formatDayMonth(effect.measurableOn)}`
    : `Visibility ${visibilityMove(effect.change)} after ${effect.days} days`;
}

export const impactAnchor = (day: string): string => `change-impact-${day}`;

export const timelineAnchor = (day: string): string => `changes-day-${day}`;
