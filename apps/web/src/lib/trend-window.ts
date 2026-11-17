import type { KeywordRecentPosition, RankingPoint } from "@asobeast/shared";

export const TREND_WINDOWS = ["7d", "30d"] as const;
export type TrendWindow = (typeof TREND_WINDOWS)[number];

export const DEFAULT_TREND_WINDOW: TrendWindow = "7d";

export const TREND_WINDOW_DAYS: Record<TrendWindow, number> = {
  "7d": 7,
  "30d": 30,
};

const DAY_MS = 86_400_000;

export const trendLabel = (window: TrendWindow): string =>
  `Last ${TREND_WINDOW_DAYS[window]} days`;

export const trendPeriod = (window: TrendWindow): string =>
  `over ${TREND_WINDOW_DAYS[window]} days`;

export type TrendSeries = ReadonlyMap<string, readonly RankingPoint[]>;

export function seriesByKeyword(
  series: readonly { keywordId: string; points: readonly RankingPoint[] }[],
): TrendSeries {
  return new Map(series.map((item) => [item.keywordId, item.points]));
}

export function checksInWindow(
  checks: readonly KeywordRecentPosition[],
  days: number,
): KeywordRecentPosition[] {
  if (checks.length === 0) return [];
  const newest = Date.parse(checks[checks.length - 1].date);
  const start = newest - (days - 1) * DAY_MS;
  return checks.filter((check) => Date.parse(check.date) >= start);
}

export function trendChecks(
  keyword: {
    keywordId: string;
    recentPositions?: readonly KeywordRecentPosition[];
  },
  window: TrendWindow,
  series: TrendSeries | undefined,
): readonly KeywordRecentPosition[] | undefined {
  if (window === "7d") return keyword.recentPositions;
  const points = series?.get(keyword.keywordId);
  return points
    ? checksInWindow(
        points.map(({ date, position }) => ({ date, position })),
        TREND_WINDOW_DAYS[window],
      )
    : undefined;
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
  return window === "7d"
    ? keyword.positionDelta7d
    : windowDelta(trendChecks(keyword, window, series));
}
