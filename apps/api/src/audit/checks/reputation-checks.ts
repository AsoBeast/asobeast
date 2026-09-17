import { AuditCheckResult } from '@asobeast/shared';
import { logScale } from '../../scoring/formulas';
import {
  aiCheck,
  AuditContext,
  check,
  ratingAverageScore,
  trendScore,
} from '../audit-scoring';

export const ratingChecks = (context: AuditContext): AuditCheckResult[] => {
  const trend = trendScore(
    context.history.ratingCountDelta30d ?? context.history.ratingAvgDelta30d,
    true,
  );
  return [
    check(
      'ratings-average',
      'Average rating',
      'auto',
      context.ratingAvg === null ? null : ratingAverageScore(context.ratingAvg),
      context.ratingAvg === null
        ? 'No rating yet.'
        : `Average rating is ${context.ratingAvg.toFixed(2)}.`,
    ),
    check(
      'ratings-count',
      'Rating count',
      'auto',
      context.ratingCount === null
        ? null
        : logScale(context.ratingCount, 100, 1_000_000),
      context.ratingCount === null
        ? 'No ratings yet.'
        : `${context.ratingCount} ratings.`,
    ),
    check(
      'ratings-trend',
      '30 day trend',
      'auto',
      trend,
      trend === null
        ? 'No 30 day history yet.'
        : 'Compared ratings to 30 days ago.',
    ),
    aiCheck('ratings-responses', 'Responds to reviews', context.aiChecks),
    aiCheck('ratings-prompts', 'Strategic rating prompts', context.aiChecks),
  ];
};
