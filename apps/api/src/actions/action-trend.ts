import {
  ActionRule,
  ActionTrendDirection,
  ActionTrendMetric,
  ActionTrendPoint,
} from '@asobeast/shared';
import {
  addDays,
  DAY_MS,
  startOfUtcDay,
  toDateKey,
} from '../analytics/analytics.support';

export const ACTION_TREND_LEAD_DAYS = 14;
export const ACTION_TREND_MIN_DAYS = 35;
export const ACTION_TREND_MAX_DAYS = 180;
export const ACTION_TREND_RATING_DAYS = 14;

export const TREND_METRIC: Record<ActionRule, ActionTrendMetric> = {
  'keyword.add_uncovered': 'position',
  'keyword.defend': 'position',
  'keyword.prune': 'position',
  'rank.investigate_drop': 'visibility',
  'serp.hold_volatile': 'position',
  'audit.fix_factor': 'audit',
  'reviews.investigate_theme': 'rating',
  'market.improve_country': 'visibility',
  'keyword.push_to_top10': 'position',
  'metadata.fix_lint': 'audit',
  'rank.investigate_unexplained_drop': 'visibility',
  'competitor.investigate_overtake': 'position',
  'reviews.investigate_rating_decline': 'rating',
  'reviews.reply_negative': 'rating',
};

export const TREND_DIRECTION: Record<ActionTrendMetric, ActionTrendDirection> =
  {
    position: 'lower_is_better',
    visibility: 'higher_is_better',
    audit: 'higher_is_better',
    rating: 'higher_is_better',
    updateAge: 'lower_is_better',
  };

export interface TrendWindow {
  from: Date;
  to: Date;
}

export function trendWindow(
  firstSeenAt: Date,
  closedAt: Date | null,
  today: Date,
): TrendWindow {
  const to = startOfUtcDay(today);
  const starts = [
    addDays(startOfUtcDay(firstSeenAt), -ACTION_TREND_LEAD_DAYS),
    addDays(to, -ACTION_TREND_MIN_DAYS),
    ...(closedAt
      ? [addDays(startOfUtcDay(closedAt), -ACTION_TREND_LEAD_DAYS)]
      : []),
  ];
  const earliest = Math.min(...starts.map((start) => start.getTime()));
  const floor = addDays(to, -ACTION_TREND_MAX_DAYS).getTime();
  return { from: new Date(Math.max(earliest, floor)), to };
}

function eachDay(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  for (let day = from.getTime(); day <= to.getTime(); day += DAY_MS) {
    days.push(new Date(day));
  }
  return days;
}

export function dailyPoints(
  values: ReadonlyArray<{ date: Date; value: number | null }>,
  from: Date,
  to: Date,
): ActionTrendPoint[] {
  const byDay = new Map<string, number | null>();
  for (const row of [...values].sort(
    (left, right) => left.date.getTime() - right.date.getTime(),
  )) {
    byDay.set(toDateKey(row.date), row.value);
  }
  return eachDay(from, to).map((day) => {
    const key = toDateKey(day);
    return byDay.has(key)
      ? { date: key, checked: true, value: byDay.get(key) ?? null }
      : { date: key, checked: false, value: null };
  });
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

export function trailingMeanPoints(
  scores: ReadonlyArray<{ date: Date; score: number }>,
  from: Date,
  to: Date,
  days: number,
): ActionTrendPoint[] {
  return eachDay(from, to).map((day) => {
    const end = day.getTime() + DAY_MS;
    const start = end - days * DAY_MS;
    const window = scores.filter(
      (row) => row.date.getTime() >= start && row.date.getTime() < end,
    );
    const date = toDateKey(day);
    if (window.length === 0) return { date, checked: false, value: null };
    const mean =
      window.reduce((sum, row) => sum + row.score, 0) / window.length;
    return { date, checked: true, value: round2(mean) };
  });
}

export function updateAgePoints(
  snapshots: ReadonlyArray<{ capturedAt: Date; storeUpdatedAt: Date | null }>,
  from: Date,
  to: Date,
): ActionTrendPoint[] {
  return dailyPoints(
    snapshots.flatMap((snapshot) => {
      if (snapshot.storeUpdatedAt === null) return [];
      const day = startOfUtcDay(snapshot.capturedAt);
      const updated = startOfUtcDay(snapshot.storeUpdatedAt);
      return [
        {
          date: snapshot.capturedAt,
          value: Math.max(
            0,
            Math.round((day.getTime() - updated.getTime()) / DAY_MS),
          ),
        },
      ];
    }),
    from,
    to,
  );
}
