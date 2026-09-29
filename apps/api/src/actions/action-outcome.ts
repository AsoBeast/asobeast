import {
  ActionOutcome,
  ActionOutcomeVerdict,
  ActionTrend,
  ActionTrendMetric,
  ActionTrendPoint,
  RANK_DEPTH,
} from '@asobeast/shared';
import { addDays, toDateKey } from '../analytics/analytics.support';

export const ACTION_OUTCOME_MIN_DAYS = 3;
export const ACTION_OUTCOME_TOLERANCE: Record<ActionTrendMetric, number> = {
  position: 1,
  visibility: 1,
  audit: 2,
  rating: 0.1,
  updateAge: 1,
};

const round1 = (value: number): number => Math.round(value * 10) / 10;

function comparable(trend: ActionTrend, point: ActionTrendPoint): number {
  if (point.value !== null) return point.value;
  return (trend.depth ?? RANK_DEPTH) + 1;
}

function verdictOf(
  trend: ActionTrend,
  change: number,
): Exclude<ActionOutcomeVerdict, 'pending'> {
  if (Math.abs(change) <= ACTION_OUTCOME_TOLERANCE[trend.metric]) {
    return 'unchanged';
  }
  const better =
    trend.direction === 'lower_is_better' ? change < 0 : change > 0;
  return better ? 'improved' : 'worsened';
}

export function measureOutcome(
  trend: ActionTrend,
  closedAt: Date,
): ActionOutcome {
  const checked = trend.points.filter((point) => point.checked);
  const closedDay = toDateKey(closedAt);
  const before = checked.filter((point) => point.date <= closedDay).at(-1);
  const after = checked.at(-1);
  const change =
    before && after
      ? round1(comparable(trend, after) - comparable(trend, before))
      : null;
  const settled =
    after !== undefined &&
    after.date >= toDateKey(addDays(closedAt, ACTION_OUTCOME_MIN_DAYS));

  return {
    metric: trend.metric,
    direction: trend.direction,
    before: before?.value ?? null,
    beforeDate: before?.date ?? null,
    after: after?.value ?? null,
    afterDate: after?.date ?? null,
    change,
    verdict: change === null || !settled ? 'pending' : verdictOf(trend, change),
  };
}
