import { logScale } from '../../scoring/formulas';
import {
  AuditContext,
  check,
  HISTORY_UNLOCK,
  ratingAverageScore,
  RubricCheck,
  trendScore,
} from '../audit-scoring';

export const ratingChecks = (context: AuditContext): RubricCheck[] => {
  const trend = trendScore(
    context.history.ratingCountDelta30d ?? context.history.ratingAvgDelta30d,
    true,
  );
  return [
    check({
      id: 'ratings-average',
      label: 'Average rating',
      source: 'store',
      weight: 3,
      score:
        context.ratingAvg === null
          ? null
          : ratingAverageScore(context.ratingAvg),
      detail:
        context.ratingAvg === null
          ? 'No rating yet.'
          : `Average rating is ${context.ratingAvg.toFixed(2)}.`,
    }),
    check({
      id: 'ratings-count',
      label: 'Rating count',
      source: 'store',
      weight: 2,
      score:
        context.ratingCount === null
          ? null
          : logScale(context.ratingCount, 100, 1_000_000),
      detail:
        context.ratingCount === null
          ? 'No ratings yet.'
          : `${context.ratingCount} ratings.`,
    }),
    check({
      id: 'ratings-trend',
      label: '30 day trend',
      source: 'store',
      weight: 2,
      score: trend,
      detail:
        trend === null
          ? 'No 30 day history yet.'
          : 'Compared ratings to 30 days ago.',
      unlock: HISTORY_UNLOCK,
    }),
  ];
};
