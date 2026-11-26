import {
  formatRankPosition,
  isRanked,
  type RankingPoint,
  type RankingSeriesItem,
  type VisibilityPoint,
} from "@asobeast/shared";
import { formatMeasureFixed, formatNumber, pluralize } from "@/lib/format";
import { MIN_TREND_POINTS } from "@/lib/trend-points";
import { utcDayNumber } from "@/lib/utc-day";

export interface ShareLinePoint {
  date: string;
  value: number | null;
}

export interface ShareHeadline {
  lead: string;
  figure: string;
  trail: string | null;
  change: string | null;
  from: string;
  to: string;
  span: number;
  line: readonly ShareLinePoint[];
}

const UNCHANGED_PLACES = 0.05;

interface Frame {
  from: string;
  to: string;
  span: number;
}

function frameOf(days: readonly string[]): Frame | null {
  const from = days[0];
  const to = days.at(-1);
  if (days.length < MIN_TREND_POINTS || from === undefined || to === undefined)
    return null;
  return { from, to, span: utcDayNumber(to) - utcDayNumber(from) };
}

const inDays = (span: number) => `in ${pluralize(span, "day")}`;

const unchanged = (span: number) => `no change ${inDays(span)}`;

function placesChange(first: number, last: number, span: number): string {
  const moved = first - last;
  if (Math.abs(moved) < UNCHANGED_PLACES) return unchanged(span);
  const direction = moved > 0 ? "up" : "down";
  return `${direction} ${formatMeasureFixed(Math.abs(moved))} places ${inDays(span)}`;
}

function rankedOnEvery(
  item: RankingSeriesItem,
  days: readonly string[],
): Map<string, number> | null {
  const ranked = new Map<string, number>();
  for (const point of item.points) {
    if (isRanked(point.position)) ranked.set(point.date, point.position);
  }
  return days.every((day) => ranked.has(day)) ? ranked : null;
}

export function rankingsHeadline(
  series: readonly RankingSeriesItem[],
): ShareHeadline | null {
  const days = [
    ...new Set(series.flatMap((item) => item.points.map(({ date }) => date))),
  ].sort();
  const frame = frameOf(days);
  if (!frame) return null;
  const set = series
    .map((item) => rankedOnEvery(item, days))
    .filter((ranked) => ranked !== null);
  if (set.length === 0) return null;
  const line = days.map((date) => ({
    date,
    value:
      set.reduce((sum, ranked) => sum + (ranked.get(date) ?? 0), 0) /
      set.length,
  }));
  const first = line[0].value;
  const last = line[line.length - 1].value;
  return {
    lead: `Average rank across ${pluralize(set.length, "keyword")}`,
    figure: `#${formatMeasureFixed(last)}`,
    trail: null,
    change: placesChange(first, last, frame.span),
    ...frame,
    line,
  };
}

const rankText = (point: RankingPoint): string =>
  isRanked(point.position)
    ? `#${point.position}`
    : formatRankPosition(point.position, point.depth, point.resultCount);

function rankChange(
  first: RankingPoint,
  last: RankingPoint,
  span: number,
): string {
  const before = isRanked(first.position) ? first.position : Infinity;
  const after = isRanked(last.position) ? last.position : Infinity;
  if (before === after) return unchanged(span);
  return `${after < before ? "up" : "down"} from ${rankText(first)}`;
}

export function keywordHeadline(
  series: RankingSeriesItem,
): ShareHeadline | null {
  const frame = frameOf(series.points.map(({ date }) => date));
  const first = series.points[0];
  const last = series.points.at(-1);
  if (!frame || first === undefined || last === undefined) return null;
  return {
    lead: "",
    figure: rankText(last),
    trail: `for “${series.text}”`,
    change: rankChange(first, last, frame.span),
    ...frame,
    line: series.points.map(({ date, position }) => ({
      date,
      value: isRanked(position) ? position : null,
    })),
  };
}

function percentChange(first: number, last: number, span: number) {
  if (first === 0) return null;
  const percent = Math.round(((last - first) / first) * 100);
  if (percent === 0) return unchanged(span);
  return `${percent > 0 ? "up" : "down"} ${Math.abs(percent)}% ${inDays(span)}`;
}

export function visibilityHeadline(
  points: readonly VisibilityPoint[],
): ShareHeadline | null {
  const frame = frameOf(points.map(({ date }) => date));
  const first = points[0];
  const last = points.at(-1);
  if (!frame || first === undefined || last === undefined) return null;
  return {
    lead: "Visibility",
    figure: formatNumber(Math.round(last.visibility)),
    trail: null,
    change: percentChange(first.visibility, last.visibility, frame.span),
    ...frame,
    line: points.map(({ date, visibility }) => ({ date, value: visibility })),
  };
}
