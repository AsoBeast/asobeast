import { AuditUnlock, KeywordComparisonRow } from '@asobeast/shared';
import { round1 } from '../audit-engine';
import {
  AuditContext,
  check,
  KEYWORDS_UNLOCK,
  priorityKeywords,
  RubricCheck,
} from '../audit-scoring';

export const FULL_VISIBILITY = 50;
export const TOP_POSITION = 10;
export const TOP10_TARGET_SHARE = 0.5;
export const GAP_SHARE_FACTOR = 2;

export const TREND_RISING = 2;
export const TREND_FLAT = -2;
export const TREND_FALLING = -10;

export const FIRST_CHECK_UNLOCK: AuditUnlock = {
  kind: 'history',
  label: 'Positions appear after the first daily check',
};

export const WEEK_HISTORY_UNLOCK: AuditUnlock = {
  kind: 'history',
  label: 'Needs 7 days of position history',
};

export const GAP_UNLOCK: AuditUnlock = {
  kind: 'competitors',
  label: 'Add competitors to find keyword gaps',
};

export const GAP_POSITIONS_UNLOCK: AuditUnlock = {
  kind: 'keywords',
  label: 'Track keywords in your home market to compare positions',
};

const trendScoreFor = (delta: number): number => {
  if (delta >= TREND_RISING) return 10;
  if (delta > TREND_FLAT) return 7;
  return delta > TREND_FALLING ? 3 : 0;
};

export const rankingChecks = (context: AuditContext): RubricCheck[] => {
  const { latest, weekAgo } = context.visibility;
  const priority = priorityKeywords(context.keywords);
  const ranked = priority.filter(
    (keyword) => keyword.position !== null && keyword.position <= TOP_POSITION,
  );
  const outside = priority
    .filter(
      (keyword) => keyword.position === null || keyword.position > TOP_POSITION,
    )
    .sort((a, b) => (b.traffic ?? 0) - (a.traffic ?? 0))[0];
  const delta =
    latest !== null && weekAgo !== null ? round1(latest - weekAgo) : null;
  const gap = trafficWeightedGap(context);

  return [
    check({
      id: 'rankings-visibility',
      label: 'Search visibility',
      source: 'rankings',
      weight: 3,
      score:
        latest === null ? null : Math.min(10, (latest / FULL_VISIBILITY) * 10),
      detail:
        latest === null
          ? 'No visibility point yet.'
          : `Visibility is ${round1(latest)}.`,
      unlock: FIRST_CHECK_UNLOCK,
      advice: {
        title: 'Raise your search visibility',
        fix: outside
          ? `Visibility is ${latest === null ? 'unknown' : round1(latest)}. Your largest keyword outside the top ${TOP_POSITION} is “${outside.text}” at ${outside.position ?? 'outside the checked depth'}.`
          : `Visibility is ${latest === null ? 'unknown' : round1(latest)}. Track and score more keywords to grow it.`,
      },
    }),
    check({
      id: 'rankings-top10',
      label: `Priority keywords in the top ${TOP_POSITION}`,
      source: 'rankings',
      weight: 2,
      score:
        priority.length === 0
          ? null
          : Math.min(
              10,
              (ranked.length / priority.length / TOP10_TARGET_SHARE) * 10,
            ),
      detail:
        priority.length === 0
          ? 'No priority keywords tracked to check.'
          : `${ranked.length} of ${priority.length} priority keywords rank in the top ${TOP_POSITION}.`,
      unlock: KEYWORDS_UNLOCK,
      advice: {
        title: `Get more priority keywords into the top ${TOP_POSITION}`,
        fix: `${ranked.length} of ${priority.length} priority keywords rank in the top ${TOP_POSITION}.`,
      },
    }),
    check({
      id: 'rankings-trend',
      label: '7 day visibility trend',
      source: 'rankings',
      weight: 2,
      score: delta === null ? null : trendScoreFor(delta),
      detail:
        delta === null
          ? 'No point 7 or more days before the latest.'
          : `Visibility moved ${delta} points in 7 days.`,
      unlock: WEEK_HISTORY_UNLOCK,
      advice:
        delta === null || delta >= 0
          ? null
          : {
              title: 'Recover your search visibility',
              fix: `Visibility fell ${Math.abs(delta)} points in 7 days.`,
            },
    }),
    check({
      id: 'rankings-competitor-gap',
      label: 'Competitor gap',
      source: 'competitors',
      weight: 2,
      score:
        gap === null
          ? null
          : 10 * (1 - Math.min(1, GAP_SHARE_FACTOR * gap.share)),
      detail:
        gap !== null
          ? `${Math.round(gap.share * 100)}% of your tracked keyword popularity sits on keywords a competitor owns.`
          : context.competitors.length === 0
            ? 'No competitors to compare positions against.'
            : 'No home market keyword has competitor positions yet.',
      unlock:
        context.competitors.length === 0 ? GAP_UNLOCK : GAP_POSITIONS_UNLOCK,
      advice: gap?.worst
        ? {
            title: `Close the gap on “${gap.worst.text}”`,
            fix: `A competitor ranks ${gap.worst.theirs} where you rank ${gap.worst.you ?? 'outside the checked depth'}. Keywords like this carry ${Math.round(gap.share * 100)}% of your tracked keyword popularity.`,
          }
        : null,
    }),
  ];
};

interface GapSummary {
  share: number;
  worst: { text: string; you: number | null; theirs: number } | null;
}

const bestCompetitorPosition = (row: KeywordComparisonRow): number | null => {
  const ranked = Object.values(row.positions).filter(
    (position): position is number =>
      position !== null && position <= TOP_POSITION,
  );
  return ranked.length === 0 ? null : Math.min(...ranked);
};

const trafficWeightedGap = (context: AuditContext): GapSummary | null => {
  if (
    context.competitors.length === 0 ||
    context.comparison.rows.length === 0
  ) {
    return null;
  }
  const traffic = new Map(
    context.keywords.map((keyword) => [keyword.id, keyword.traffic ?? 1]),
  );
  let total = 0;
  let gapped = 0;
  let worst: GapSummary['worst'] = null;
  let worstTraffic = -1;
  for (const row of context.comparison.rows) {
    const weight = traffic.get(row.keywordId);
    if (weight === undefined) continue;
    total += weight;
    const theirs = bestCompetitorPosition(row);
    if (theirs === null || (row.you !== null && row.you <= theirs)) {
      continue;
    }
    gapped += weight;
    if (weight > worstTraffic) {
      worstTraffic = weight;
      worst = { text: row.text, you: row.you, theirs };
    }
  }
  return total === 0 ? null : { share: gapped / total, worst };
};
