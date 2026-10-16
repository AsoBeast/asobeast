import type {
  ChangeImpactFunnel,
  ChangeImpactMovement,
  ChangeImpactWindow,
} from "@asobeast/shared";
import { formatConversion, formatCount } from "@/lib/funnel";
import { formatDate, formatMeasure } from "@/lib/format";

const dateList = new Intl.ListFormat("en-US", { type: "conjunction" });

const plural = (count: number, noun: string): string =>
  `${count} ${noun}${count === 1 ? "" : "s"}`;

export function windowTitle(days: number): string {
  return `After ${days} days`;
}

export function windowStatusLine(
  impact: Pick<ChangeImpactWindow, "status" | "targetDate" | "measuredOn">,
): string {
  if (impact.status === "pending") {
    return `Measurable on ${formatDate(impact.targetDate)}`;
  }
  if (impact.status === "measured") {
    return `Measured on ${formatDate(impact.measuredOn)}`;
  }
  return `No rank check near ${formatDate(impact.targetDate)}`;
}

export function movementLine(movement: ChangeImpactMovement): string {
  return `${movement.improved} improved, ${movement.declined} declined`;
}

export function rankingShiftLine(
  movement: ChangeImpactMovement,
): string | null {
  const parts = [
    movement.entered > 0 ? `${movement.entered} started ranking` : null,
    movement.exited > 0 ? `${movement.exited} stopped ranking` : null,
  ].filter((part): part is string => part !== null);
  return parts.length === 0 ? null : parts.join(", ");
}

export function measuredLine(movement: ChangeImpactMovement): string {
  return `${plural(movement.measured, "keyword")} checked on both days`;
}

export function visibilityRange(
  impact: Pick<ChangeImpactWindow, "visibilityBefore" | "visibilityAfter">,
): string | null {
  const { visibilityBefore: before, visibilityAfter: after } = impact;
  if (before === null || after === null) return null;
  return `${formatMeasure(before)} → ${formatMeasure(after)}`;
}

export function overlapNotice(dates: readonly string[]): string | null {
  if (dates.length === 0) return null;
  const list = dateList.format(dates.map((date) => formatDate(date)));
  return dates.length === 1
    ? `Another change on ${list} falls inside this window.`
    : `Other changes on ${list} fall inside this window.`;
}

export function impactScopeLine({
  days,
  totalChanges,
  shown,
}: {
  days: number;
  totalChanges: number;
  shown: number;
}): string {
  return shown === totalChanges
    ? `${plural(shown, "change")} to your listing in the last ${days} days`
    : `The ${shown} newest of ${totalChanges} changes to your listing in the last ${days} days`;
}

export interface FunnelRanges {
  gets: string;
  conversion: string;
}

export function funnelRanges(
  funnel: ChangeImpactFunnel | null | undefined,
): FunnelRanges | null {
  if (funnel?.status !== "measured" || !funnel.before || !funnel.after) {
    return null;
  }
  return {
    gets: `${formatCount(funnel.before.gets)} → ${formatCount(funnel.after.gets)}`,
    conversion: `${formatConversion(funnel.before.conversion)} → ${formatConversion(funnel.after.conversion)}`,
  };
}

export function funnelNote(
  funnel: ChangeImpactFunnel | null | undefined,
  days: number,
): string | null {
  if (!funnel || funnel.status === "measured") return null;
  if (funnel.status === "unmeasured") {
    return "No console data before this change";
  }
  if (funnel.finalOn) {
    return `Apple's numbers for this window are final by ${formatDate(funnel.finalOn)}`;
  }
  return `Apple's numbers for this window are final in ${plural(days - funnel.completeDays, "day")}`;
}
