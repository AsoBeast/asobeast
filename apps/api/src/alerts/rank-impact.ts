import {
  positionWeight,
  UNSCORED_TRAFFIC,
  type RankDroppedPayload,
  type RankFirstPayload,
  type RankImprovedPayload,
  type RankMilestonePayload,
  type RankOvertakenPayload,
} from '@asobeast/shared';

export type RankMovePayload =
  | RankDroppedPayload
  | RankImprovedPayload
  | RankMilestonePayload
  | RankFirstPayload
  | RankOvertakenPayload;

const RANK_MOVE_EVENTS: ReadonlySet<string> = new Set<RankMovePayload['event']>(
  [
    'rank.dropped',
    'rank.improved',
    'rank.milestone',
    'rank.first',
    'rank.overtaken',
  ],
);

export const isRankMove = (payload: {
  event: string;
}): payload is RankMovePayload => RANK_MOVE_EVENTS.has(payload.event);

export type KeywordTraffic = ReadonlyMap<string, number | null>;

export interface Move {
  traffic: number | null | undefined;
  from: number | null;
  to: number | null;
}

export function moveImpact({ traffic, from, to }: Move): number {
  return (
    (traffic ?? UNSCORED_TRAFFIC) *
    Math.abs(positionWeight(to) - positionWeight(from))
  );
}

export function impactOfPayload(
  payload: RankMovePayload,
  traffic: KeywordTraffic,
): number {
  const keywordTraffic = traffic.get(payload.keyword.id);
  if (payload.event === 'rank.first') {
    return moveImpact({
      traffic: keywordTraffic,
      from: null,
      to: payload.position,
    });
  }
  return moveImpact({
    traffic: keywordTraffic,
    from: payload.from,
    to: payload.to,
  });
}

export function compareImpact(
  traffic: KeywordTraffic,
): (left: RankMovePayload, right: RankMovePayload) => number {
  return (left, right) =>
    impactOfPayload(right, traffic) - impactOfPayload(left, traffic) ||
    left.keyword.text.localeCompare(right.keyword.text) ||
    left.keyword.id.localeCompare(right.keyword.id);
}

export function byImpact<T extends RankMovePayload>(
  moves: readonly T[],
  traffic: KeywordTraffic | undefined,
): T[] {
  return traffic ? [...moves].sort(compareImpact(traffic)) : [...moves];
}
