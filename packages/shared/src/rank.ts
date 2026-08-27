export const RANK_DEPTH = 200;

export const isRanked = (
  position: number | null | undefined,
): position is number => position != null && position >= 1;

export const formatRankPosition = (
  position: number | null | undefined,
  depth: number = RANK_DEPTH,
): string => (isRanked(position) ? String(position) : `>${depth}`);

export const formatCheckedPosition = (
  position: number | null,
  depth: number | null,
): string | null =>
  depth === null ? null : formatRankPosition(position, depth);
