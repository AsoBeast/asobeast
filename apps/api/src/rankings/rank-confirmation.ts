import { RANK_MILESTONE_TIERS, RankMilestoneTier } from '@asobeast/shared';
import { inTier } from './rank-milestones';

export type Position = number | null;

export interface RankCheck {
  position: Position;
  depth: number;
}

export interface ConfirmationWindow {
  checks: readonly RankCheck[];
  today: Position;
  threshold: number;
}

export interface ConfirmedMove {
  from: number;
  fromDepth: number;
}

export interface ConfirmedExit extends ConfirmedMove {
  tier: RankMilestoneTier;
}

type Slide = (from: Position, to: Position) => boolean;

const dropSlide =
  (threshold: number): Slide =>
  (from, to) =>
    from !== null && (to === null || to - from >= threshold);

const riseSlide =
  (threshold: number): Slide =>
  (from, to) =>
    to !== null && (from === null || from - to >= threshold);

const exitSlide =
  (tier: RankMilestoneTier): Slide =>
  (from, to) =>
    inTier(from, tier) && !inTier(to, tier);

const slidesOf = (threshold: number): Slide[] => [
  dropSlide(threshold),
  ...RANK_MILESTONE_TIERS.map((tier) => exitSlide(tier)),
];

const positionsOf = (window: ConfirmationWindow): Position[] =>
  window.checks.map(({ position }) => position);

function isPending(slide: Slide, window: ConfirmationWindow): boolean {
  const [previous, start, earlier] = positionsOf(window);
  if (window.checks.length < 2 || !slide(start, previous)) return false;
  return (
    window.checks.length < 3 ||
    !slidesOf(window.threshold).some(
      (reported) => reported(earlier, start) && reported(earlier, previous),
    )
  );
}

const holds = (slide: Slide, window: ConfirmationWindow): boolean =>
  slide(window.checks[1].position, window.today);

const confirms = (slide: Slide, window: ConfirmationWindow): boolean =>
  isPending(slide, window) && holds(slide, window);

function baselineOf(window: ConfirmationWindow): ConfirmedMove | null {
  const { position, depth } = window.checks[1];
  return position === null ? null : { from: position, fromDepth: depth };
}

export function confirmedDrop(
  window: ConfirmationWindow,
): ConfirmedMove | null {
  return confirms(dropSlide(window.threshold), window)
    ? baselineOf(window)
    : null;
}

export function confirmedExit(
  window: ConfirmationWindow,
): ConfirmedExit | null {
  const tier = [...RANK_MILESTONE_TIERS]
    .reverse()
    .find((candidate) => confirms(exitSlide(candidate), window));
  if (tier === undefined) return null;
  const baseline = baselineOf(window);
  return baseline === null ? null : { tier, ...baseline };
}

export const undoesDrop = (window: ConfirmationWindow): boolean =>
  isPending(dropSlide(window.threshold), window) &&
  !holds(riseSlide(window.threshold), window);

export const undoesExit = (
  window: ConfirmationWindow,
  tier: RankMilestoneTier,
): boolean => isPending(exitSlide(tier), window);
