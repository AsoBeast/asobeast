import {
  CHANGE_FIELD_LABELS,
  type ChangeEventItem,
  type ChangeField,
  type TrackedKeywordItem,
} from "@asobeast/shared";
import { MIN_TREND_POINTS } from "@/components/charts/ChartStates";
import { hasCheck, type RankingChartData } from "@/components/rankings/pivot";
import { formatDayMonth } from "@/lib/format";
import type { RangePreset } from "@/lib/ranges";

export type HistoryView =
  { kind: "empty" } | { kind: "chart"; line: boolean; notes: string[] };

const seriesOf = (chart: RankingChartData) => chart.keywordIds[0] ?? "";

const positionOn = (chart: RankingChartData, index: number) => {
  const value = chart.rows[index]?.[seriesOf(chart)];
  return typeof value === "number" ? value : null;
};

const checkedIndexes = (chart: RankingChartData) =>
  chart.depths.flatMap((depths, index) => (hasCheck(depths) ? [index] : []));

function pausedNote(keyword: TrackedKeywordItem): string {
  const day = keyword.latestCheckedOn ?? null;
  return day === null
    ? "Paused"
    : `Paused, last checked ${formatDayMonth(day)}`;
}

export function historyView(
  chart: RankingChartData,
  keyword: TrackedKeywordItem,
): HistoryView {
  const checked = checkedIndexes(chart);
  if (checked.length === 0) return { kind: "empty" };

  const line = checked.length >= MIN_TREND_POINTS;
  const notes: string[] = [];
  if (!line) {
    notes.push(
      `${checked.length} ${checked.length === 1 ? "check" : "checks"} so far, the line appears after ${MIN_TREND_POINTS}`,
    );
  }
  if (checked.every((index) => positionOn(chart, index) === null)) {
    const deepest = Math.max(
      ...checked.map((index) => chart.depths[index]?.[seriesOf(chart)] ?? 0),
    );
    notes.push(`Not in the top ${deepest} in this range`);
  }
  if (!keyword.active) notes.push(pausedNote(keyword));
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

export const changedFieldsLabel = (fields: readonly ChangeField[]) =>
  fields.map((field) => CHANGE_FIELD_LABELS[field]).join(", ");

export function movementLine(places: number, day: string): string {
  const since = `since ${formatDayMonth(day)}`;
  if (places === 0) return `No change ${since}`;
  return `${places > 0 ? "Up" : "Down"} ${Math.abs(places)} ${since}`;
}

export function rankingsHistoryHref(
  appId: string,
  keywordId: string,
  range: RangePreset,
): string {
  const query = new URLSearchParams({ keywords: keywordId, range });
  return `/apps/${appId}/rankings?${query}`;
}
