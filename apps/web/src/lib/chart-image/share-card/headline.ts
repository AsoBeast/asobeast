import {
  formatRankPosition,
  isRanked,
  type RankingPoint,
  type RankingSeriesItem,
  type VisibilityPoint,
} from "@asobeast/shared";
import { formatMeasure, formatNumber, pluralize } from "@/lib/format";
import { MIN_TREND_POINTS } from "@/lib/trend-points";
import { utcDayNumber } from "@/lib/utc-day";

export interface ShareLinePoint {
  date: string;
  value: number | null;
}

export type ShareDirection = "up" | "down" | "flat";

export interface ShareChange {
  direction: ShareDirection;
  text: string;
}

export interface ShareHeadline {
  lead: string;
  term: string | null;
  figure: string;
  change: ShareChange | null;
  from: string;
  to: string;
  span: number;
  line: readonly ShareLinePoint[];
}

const UNCHANGED_PLACES = 0.05;
const NO_CHANGE: ShareChange = { direction: "flat", text: "no change" };

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

export const spanText = (span: number) => `in ${pluralize(span, "day")}`;

export const quotedTerm = (term: string) => `“${term}”`;

function placesChange(first: number, last: number): ShareChange {
  const moved = first - last;
  if (Math.abs(moved) < UNCHANGED_PLACES) return NO_CHANGE;
  const direction = moved > 0 ? "up" : "down";
  const places = formatMeasure(Math.abs(moved));
  return {
    direction,
    text: `${direction} ${places} ${places === "1" ? "place" : "places"}`,
  };
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
    term: null,
    figure: `#${formatMeasure(last)}`,
    change: placesChange(first, last),
    ...frame,
    line,
  };
}

const rankText = (point: RankingPoint): string =>
  isRanked(point.position)
    ? `#${point.position}`
    : formatRankPosition(point.position, point.depth, point.resultCount);

function rankChange(first: RankingPoint, last: RankingPoint): ShareChange {
  const before = isRanked(first.position) ? first.position : Infinity;
  const after = isRanked(last.position) ? last.position : Infinity;
  if (before === after) return NO_CHANGE;
  const direction = after < before ? "up" : "down";
  return { direction, text: `${direction} from ${rankText(first)}` };
}

export function keywordHeadline(
  series: RankingSeriesItem,
): ShareHeadline | null {
  const frame = frameOf(series.points.map(({ date }) => date));
  const first = series.points[0];
  const last = series.points.at(-1);
  if (!frame || first === undefined || last === undefined) return null;
  return {
    lead: "Rank for",
    term: series.text,
    figure: rankText(last),
    change: rankChange(first, last),
    ...frame,
    line: series.points.map(({ date, position }) => ({
      date,
      value: isRanked(position) ? position : null,
    })),
  };
}

function percentChange(first: number, last: number): ShareChange | null {
  if (first === 0) return null;
  const percent = Math.round(((last - first) / first) * 100);
  if (percent === 0) return NO_CHANGE;
  const direction = percent > 0 ? "up" : "down";
  return { direction, text: `${direction} ${Math.abs(percent)}%` };
}

export function visibilityHeadline(
  points: readonly VisibilityPoint[],
): ShareHeadline | null {
  const frame = frameOf(points.map(({ date }) => date));
  const first = points[0];
  const last = points.at(-1);
  if (!frame || first === undefined || last === undefined) return null;
  return {
    lead: "Visibility score",
    term: null,
    figure: formatNumber(Math.round(last.visibility)),
    change: percentChange(first.visibility, last.visibility),
    ...frame,
    line: points.map(({ date, visibility }) => ({ date, value: visibility })),
  };
}

export function headlineSentence(
  headline: ShareHeadline,
  withChange: boolean,
): string {
  const subject =
    headline.term === null
      ? headline.lead
      : `${headline.lead} ${quotedTerm(headline.term)}`;
  const statement = `${subject} ${headline.figure}`;
  return withChange && headline.change !== null
    ? `${statement}, ${headline.change.text} ${spanText(headline.span)}`
    : statement;
}
