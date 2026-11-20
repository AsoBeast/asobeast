import {
  addUtcDays,
  KEYWORD_RECENT_POSITION_DAYS,
  type KeywordRecentPosition,
  type RankingPoint,
} from "@asobeast/shared";

export const TREND_WINDOWS = ["7d", "30d"] as const;
export type TrendWindow = (typeof TREND_WINDOWS)[number];

export const DEFAULT_TREND_WINDOW: TrendWindow = "7d";

export const TREND_WINDOW_DAYS: Record<TrendWindow, number> = {
  "7d": KEYWORD_RECENT_POSITION_DAYS,
  "30d": 30,
};

export interface TrendFrame {
  days: number;
  end?: string;
}

export const trendSpan = (window: TrendWindow): string =>
  `${TREND_WINDOW_DAYS[window]} days`;

export const trendLabel = (window: TrendWindow): string =>
  `Last ${trendSpan(window)}`;

export const trendPeriod = (window: TrendWindow): string =>
  `over ${trendSpan(window)}`;

export function trendFrame(window: TrendWindow, today: string): TrendFrame {
  const days = TREND_WINDOW_DAYS[window];
  return window === DEFAULT_TREND_WINDOW ? { days } : { days, end: today };
}

export function trendRange(
  window: TrendWindow,
  today: string,
): { from: string; to: string } {
  return { from: addUtcDays(today, 1 - TREND_WINDOW_DAYS[window]), to: today };
}

export type TrendState = "ready" | "pending" | "failed";

export const TREND_STATE_TEXT: Record<Exclude<TrendState, "ready">, string> = {
  pending: "Loading",
  failed: "Not loaded",
};

export type TrendSeries = ReadonlyMap<string, readonly RankingPoint[]>;

export function seriesByKeyword(
  series: readonly { keywordId: string; points: readonly RankingPoint[] }[],
): TrendSeries {
  return new Map(series.map((item) => [item.keywordId, item.points]));
}

export function trendChecks(
  keyword: {
    keywordId: string;
    recentPositions?: readonly KeywordRecentPosition[];
  },
  window: TrendWindow,
  series: TrendSeries | undefined,
): readonly KeywordRecentPosition[] | undefined {
  return window === DEFAULT_TREND_WINDOW
    ? keyword.recentPositions
    : series?.get(keyword.keywordId);
}

export function windowDelta(
  checks: readonly KeywordRecentPosition[] | undefined,
): number | null {
  if (!checks || checks.length === 0) return null;
  const latest = checks[checks.length - 1];
  if (latest.position === null) return null;
  const first = checks.find((check) => check.position !== null);
  if (!first || first === latest || first.position === null) return null;
  return latest.position - first.position;
}

export function trendDelta(
  keyword: {
    keywordId: string;
    positionDelta7d: number | null;
    recentPositions?: readonly KeywordRecentPosition[];
  },
  window: TrendWindow,
  series: TrendSeries | undefined,
): number | null {
  return window === DEFAULT_TREND_WINDOW
    ? keyword.positionDelta7d
    : windowDelta(trendChecks(keyword, window, series));
}
