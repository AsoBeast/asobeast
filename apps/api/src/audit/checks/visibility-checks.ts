import {
  AuditContext,
  check,
  HISTORY_UNLOCK,
  RubricCheck,
  trendScore,
} from '../audit-scoring';

export const rankingChecks = (context: AuditContext): RubricCheck[] => {
  const { top10Share, rankedShare, avgDelta7d, gapCount } = context.rankings;
  return [
    check({
      id: 'rankings-top10',
      label: 'Top 10 presence',
      source: 'rankings',
      weight: 2,
      score: top10Share * 10,
      detail: `${Math.round(top10Share * 100)}% of keywords in the top 10.`,
    }),
    check({
      id: 'rankings-coverage',
      label: 'Keyword coverage',
      source: 'rankings',
      weight: 3,
      score: rankedShare * 10,
      detail: `${Math.round(rankedShare * 100)}% of keywords ranked.`,
    }),
    check({
      id: 'rankings-trend',
      label: 'Ranking trend',
      source: 'rankings',
      weight: 2,
      score: trendScore(avgDelta7d, false),
      detail:
        avgDelta7d === null
          ? 'No 7 day trend yet.'
          : 'Average 7 day position change.',
      unlock: HISTORY_UNLOCK,
    }),
    check({
      id: 'rankings-gap',
      label: 'Competitor gap',
      source: 'competitors',
      weight: 2,
      score: 10 - gapCount,
      detail: `${gapCount} keywords where competitors lead.`,
    }),
  ];
};
