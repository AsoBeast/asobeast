import { AuditCheckResult } from '@asobeast/shared';
import { clamp } from '../../scoring/formulas';
import { AuditContext, check, trendScore } from '../audit-scoring';

export const rankingChecks = (context: AuditContext): AuditCheckResult[] => {
  const { top10Share, rankedShare, avgDelta7d, gapCount } = context.rankings;
  return [
    check(
      'rankings-top10',
      'Top 10 presence',
      'auto',
      clamp(top10Share * 10, 0, 10),
      `${Math.round(top10Share * 100)}% of keywords in the top 10.`,
    ),
    check(
      'rankings-coverage',
      'Keyword coverage',
      'auto',
      clamp(rankedShare * 10, 0, 10),
      `${Math.round(rankedShare * 100)}% of keywords ranked.`,
    ),
    check(
      'rankings-trend',
      'Ranking trend',
      'auto',
      trendScore(avgDelta7d, false),
      avgDelta7d === null
        ? 'No 7 day trend yet.'
        : 'Average 7 day position change.',
    ),
    check(
      'rankings-gap',
      'Competitor gap',
      'auto',
      clamp(10 - gapCount, 0, 10),
      `${gapCount} keywords where competitors lead.`,
    ),
  ];
};
