import { addUtcDays } from './utc-days';

export const RANK_DEPTH = 200;

export const NO_APPS_LABEL = 'No apps';

export const NO_APPS_SENTENCE = 'The store lists no apps for this search';

export const listsNoApps = (resultCount: number | null | undefined): boolean =>
  resultCount === 0;

export const isRanked = (
  position: number | null | undefined,
): position is number => position != null && position >= 1;

export const formatRankPosition = (
  position: number | null | undefined,
  depth: number = RANK_DEPTH,
  resultCount?: number | null,
): string => {
  if (isRanked(position)) return String(position);
  if (listsNoApps(resultCount)) return NO_APPS_LABEL;
  return `>${depth}`;
};

export const formatCheckedPosition = (
  position: number | null,
  depth: number | null,
  resultCount?: number | null,
): string | null =>
  depth === null ? null : formatRankPosition(position, depth, resultCount);

export const CHECK_FRESH_DAYS = 1;

export const isCheckFresh = (checkedOn: string, today: string): boolean =>
  checkedOn >= addUtcDays(today, -CHECK_FRESH_DAYS);

export const RANK_MILESTONE_TIERS = [1, 3, 10] as const;
export type RankMilestoneTier = (typeof RANK_MILESTONE_TIERS)[number];

export const tierOf = (
  position: number | null | undefined,
): RankMilestoneTier | null =>
  isRanked(position)
    ? (RANK_MILESTONE_TIERS.find((tier) => position <= tier) ?? null)
    : null;

export const RANK_MILESTONE_DIRECTIONS = ['entered', 'left'] as const;
export type RankMilestoneDirection = (typeof RANK_MILESTONE_DIRECTIONS)[number];
