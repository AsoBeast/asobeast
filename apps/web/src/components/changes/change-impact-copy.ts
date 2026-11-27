import type {
  ChangeImpactFunnel,
  ChangeImpactMovement,
  ChangeImpactWindow,
} from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enChanges from "../../../messages/en/changes.json";
import type { MessageTranslator } from "@/i18n/translator";
import { formatConversion, formatCount } from "@/lib/funnel";
import {
  formatDateInLocale,
  formatListInLocale,
  formatMeasureFixedInLocale,
} from "@/lib/format";
import type { Locale } from "@/lib/locale";

const english = createTranslator({
  locale: "en",
  namespace: "changes",
  messages: { changes: enChanges },
});

export function windowTitle(
  days: number,
  t: MessageTranslator = english,
): string {
  return t("impact.afterDays", { days });
}

export function windowStatusLine(
  impact: Pick<ChangeImpactWindow, "status" | "targetDate" | "measuredOn">,
  t: MessageTranslator = english,
  locale: Locale = "en",
): string {
  if (impact.status === "pending") {
    return t("impact.pending", {
      date: formatDateInLocale(impact.targetDate, locale),
    });
  }
  if (impact.status === "measured") {
    return t("impact.measured", {
      date: formatDateInLocale(impact.measuredOn, locale),
    });
  }
  return t("impact.missingCheck", {
    date: formatDateInLocale(impact.targetDate, locale),
  });
}

export function movementLine(
  movement: ChangeImpactMovement,
  t: MessageTranslator = english,
): string {
  return t("impact.movement", {
    improved: movement.improved,
    declined: movement.declined,
  });
}

export function rankingShiftLine(
  movement: ChangeImpactMovement,
  t: MessageTranslator = english,
): string | null {
  const parts = [
    movement.entered > 0
      ? t("impact.entered", { count: movement.entered })
      : null,
    movement.exited > 0 ? t("impact.exited", { count: movement.exited }) : null,
  ].filter((part): part is string => part !== null);
  return parts.length === 0 ? null : parts.join(", ");
}

export function measuredLine(
  movement: ChangeImpactMovement,
  t: MessageTranslator = english,
): string {
  return t("impact.checked", { count: movement.measured });
}

export function visibilityRange(
  impact: Pick<ChangeImpactWindow, "visibilityBefore" | "visibilityAfter">,
  locale: Locale = "en",
): string | null {
  const { visibilityBefore: before, visibilityAfter: after } = impact;
  if (before === null || after === null) return null;
  return `${formatMeasureFixedInLocale(before, locale)} → ${formatMeasureFixedInLocale(after, locale)}`;
}

export function overlapNotice(
  dates: readonly string[],
  t: MessageTranslator = english,
  locale: Locale = "en",
): string | null {
  if (dates.length === 0) return null;
  const list = formatListInLocale(
    dates.map((date) => formatDateInLocale(date, locale)),
    locale,
  );
  return t(dates.length === 1 ? "impact.overlapOne" : "impact.overlapMany", {
    dates: list,
  });
}

export function impactScopeLine(
  {
    days,
    totalChanges,
    shown,
  }: {
    days: number;
    totalChanges: number;
    shown: number;
  },
  t: MessageTranslator = english,
): string {
  return shown === totalChanges
    ? t("impact.scopeAll", { count: shown, days })
    : t("impact.scopeShown", { shown, total: totalChanges, days });
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
  t: MessageTranslator = english,
  locale: Locale = "en",
): string | null {
  if (!funnel || funnel.status === "measured") return null;
  if (funnel.status === "unmeasured") {
    return t("impact.funnelUnmeasured");
  }
  if (funnel.finalOn) {
    return t("impact.funnelFinalOn", {
      date: formatDateInLocale(funnel.finalOn, locale),
    });
  }
  return t("impact.funnelFinalIn", {
    days: days - funnel.completeDays,
  });
}
