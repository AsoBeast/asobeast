export const RATING_DROP_DEFAULT_TENTHS = 1;
export const RATING_DROP_MIN_TENTHS = 1;
export const RATING_DROP_MAX_TENTHS = 10;
export const RATING_DROP_TENTHS_CHOICES = [1, 2, 3, 5] as const;

export function isRatingDropTenths(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= RATING_DROP_MIN_TENTHS &&
    value <= RATING_DROP_MAX_TENTHS
  );
}

export function listsRatingDrop(
  ratingDropTenths: number | null | undefined,
  dropTenths: number,
): boolean {
  const wanted = Math.max(
    ratingDropTenths ?? RATING_DROP_DEFAULT_TENTHS,
    RATING_DROP_DEFAULT_TENTHS,
  );
  return dropTenths >= wanted;
}

export function ratingDropLabel(tenths: number): string {
  const stars = tenths / 10;
  const singular = tenths === RATING_DROP_MIN_TENTHS || stars === 1;
  return `${stars} ${singular ? 'star' : 'stars'}`;
}
