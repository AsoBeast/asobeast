import {
  RANK_MILESTONE_TIERS,
  RankMilestoneDirection,
  RankMilestoneTier,
} from '@asobeast/shared';

export interface RankMilestone {
  tier: RankMilestoneTier;
  direction: RankMilestoneDirection;
}

export interface PositionPair {
  app: number | null;
  competitor: number | null;
}

export interface RankCapture {
  position: number | null;
  changed: boolean;
}

export interface CompetitorCapture extends RankCapture {
  id: string;
  name: string | null;
}

export type PositionAlert =
  | { event: 'rank.first'; position: number }
  | { event: 'rank.milestone'; milestone: RankMilestone };

const inTier = (position: number | null, tier: number): boolean =>
  position !== null && position <= tier;

export function rankMilestone(
  from: number | null,
  to: number | null,
): RankMilestone | null {
  const entered = RANK_MILESTONE_TIERS.find(
    (tier) => inTier(to, tier) && !inTier(from, tier),
  );
  if (entered !== undefined) return { tier: entered, direction: 'entered' };
  const left = [...RANK_MILESTONE_TIERS]
    .reverse()
    .find((tier) => inTier(from, tier) && !inTier(to, tier));
  return left === undefined ? null : { tier: left, direction: 'left' };
}

const ahead = (a: number | null, b: number | null): boolean =>
  a !== null && (b === null || a < b);

export const overtaken = (
  previous: PositionPair,
  current: PositionPair,
): boolean =>
  ahead(previous.app, previous.competitor) &&
  ahead(current.competitor, current.app);

export function positionAlert(
  from: number | null,
  to: number | null,
  rankedEarlier: boolean,
): PositionAlert | null {
  if (from === null && to !== null && !rankedEarlier) {
    return { event: 'rank.first', position: to };
  }
  const milestone = rankMilestone(from, to);
  return milestone === null ? null : { event: 'rank.milestone', milestone };
}
