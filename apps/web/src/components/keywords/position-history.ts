import { createTranslator } from "next-intl";
import enKeywords from "../../../messages/en/keywords.json";
import type { MessageTranslator } from "@/i18n/translator";
import {
  CHANGE_FIELD_LABELS,
  listsNoApps,
  type ChangeEventItem,
  type ChangeField,
  type TrackedKeywordItem,
} from "@asobeast/shared";
import { MIN_TREND_POINTS } from "@/lib/trend-points";
import { hasCheck, type RankingChartData } from "@/components/charts/pivot";
import { formatDayMonthInLocale } from "@/lib/format";
import type { Locale } from "@/lib/locale";
import type { RangePreset } from "@/lib/ranges";

const english = createTranslator({
  locale: "en",
  namespace: "keywords",
  messages: { keywords: enKeywords },
});

export type HistoryView =
  { kind: "empty" } | { kind: "chart"; line: boolean; notes: string[] };

const seriesOf = (chart: RankingChartData) => chart.keywordIds[0] ?? "";

const positionOn = (chart: RankingChartData, index: number) => {
  const value = chart.rows[index]?.[seriesOf(chart)];
  return typeof value === "number" ? value : null;
};

const checkedIndexes = (chart: RankingChartData) =>
  chart.depths.flatMap((depths, index) => (hasCheck(depths) ? [index] : []));

function pausedNote(
  keyword: TrackedKeywordItem,
  t: MessageTranslator,
  locale: Locale,
): string {
  const day = keyword.latestCheckedOn ?? null;
  return day === null
    ? t("history.paused")
    : t("history.pausedOn", {
        day: formatDayMonthInLocale(day, locale),
      });
}

export function historyView(
  chart: RankingChartData,
  keyword: TrackedKeywordItem,
  t: MessageTranslator = english,
  locale: Locale = "en",
): HistoryView {
  const checked = checkedIndexes(chart);
  if (checked.length === 0) return { kind: "empty" };

  const line = checked.length >= MIN_TREND_POINTS;
  const notes: string[] = [];
  if (!line) {
    notes.push(
      t("history.checksSoFar", {
        count: checked.length,
        needed: MIN_TREND_POINTS,
      }),
    );
  }
  if (checked.every((index) => positionOn(chart, index) === null)) {
    if (
      checked.every((index) =>
        listsNoApps(chart.resultCounts[index]?.[seriesOf(chart)]),
      )
    ) {
      notes.push(t("history.noAppsNote"));
    } else {
      const deepest = Math.max(
        ...checked.map((index) => chart.depths[index]?.[seriesOf(chart)] ?? 0),
      );
      notes.push(t("history.notInRange", { depth: deepest }));
    }
  }
  if (!keyword.active) notes.push(pausedNote(keyword, t, locale));
  return { kind: "chart", line, notes };
}

export function listingChangeDays(
  events: readonly ChangeEventItem[],
  market: { country: string; homeCountry: string },
): Map<string, ChangeField[]> {
  const days = new Map<string, ChangeField[]>();
  for (const event of events) {
    if (event.isCompetitor) continue;
    if ((event.country ?? market.homeCountry) !== market.country) continue;
    const day = event.capturedAt.slice(0, 10);
    const fields = days.get(day) ?? [];
    if (!fields.includes(event.field)) fields.push(event.field);
    days.set(day, fields);
  }
  return days;
}

export function changeSincePrevious(
  chart: RankingChartData,
  index: number,
): { day: string; places: number } | null {
  const previous = checkedIndexes(chart).findLast((checked) => checked < index);
  if (previous === undefined) return null;
  const before = positionOn(chart, previous);
  const now = positionOn(chart, index);
  if (before === null || now === null) return null;
  return { day: String(chart.rows[previous]?.date), places: before - now };
}

export const changedFieldsLabel = (
  fields: readonly ChangeField[],
  t: MessageTranslator = english,
  locale: Locale = "en",
) =>
  fields
    .map((field) => t(`changeFields.${field}`))
    .join(locale === "en" ? ", " : "、");

export function movementLine(
  places: number,
  day: string,
  t: MessageTranslator = english,
  locale: Locale = "en",
): string {
  const since = t("history.since", {
    day: formatDayMonthInLocale(day, locale),
  });
  if (places === 0) return t("history.noChange", { since });
  return t(places > 0 ? "history.up" : "history.down", {
    count: Math.abs(places),
    since,
  });
}

export function rankingsHistoryHref(
  appId: string,
  keywordId: string,
  range: RangePreset,
): string {
  const query = new URLSearchParams({ keywords: keywordId, range });
  return `/apps/${appId}/rankings?${query}`;
}
