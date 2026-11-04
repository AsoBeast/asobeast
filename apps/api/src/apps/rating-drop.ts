import { utcDayOf } from '@asobeast/shared';

export const RATING_DROP_WINDOW_DAYS = 7;
export const RATING_DROP_REFERENCE_SLACK_DAYS = 3;
export const RATING_DROP_MIN_COUNT = 20;
export const RATING_DROP_HISTORY_DAYS = 14;

const DAY_MS = 86_400_000;
const NEAREST_REFERENCE_MS = RATING_DROP_WINDOW_DAYS * DAY_MS;
const FARTHEST_REFERENCE_MS =
  (RATING_DROP_WINDOW_DAYS + RATING_DROP_REFERENCE_SLACK_DAYS) * DAY_MS;

export interface RatedSnapshot {
  capturedAt: Date;
  ratingAvg: number | null;
  ratingCount: number | null;
  version: string | null;
}

export interface RatingDrop {
  from: number;
  to: number;
  fromCount: number;
  toCount: number;
  fromDate: string;
  toDate: string;
  dropTenths: number;
  version: string | null;
}

type Rated = RatedSnapshot & { ratingAvg: number; ratingCount: number };

const rated = (snapshot: RatedSnapshot | undefined): snapshot is Rated =>
  snapshot !== undefined &&
  snapshot.ratingAvg !== null &&
  snapshot.ratingCount !== null &&
  snapshot.ratingCount >= RATING_DROP_MIN_COUNT;

const hundredths = (average: number): number => Math.round(average * 100);

function referenceOf(
  history: readonly RatedSnapshot[],
  index: number,
  latest: Rated,
): Rated | null {
  const reference = history.slice(index + 1).find((snapshot) => {
    const age = latest.capturedAt.getTime() - snapshot.capturedAt.getTime();
    return (
      age >= NEAREST_REFERENCE_MS &&
      age <= FARTHEST_REFERENCE_MS &&
      rated(snapshot)
    );
  });
  return rated(reference) ? reference : null;
}

const shippedVersion = (latest: Rated, reference: Rated): string | null =>
  latest.version !== null && latest.version !== reference.version
    ? latest.version
    : null;

export function ratingDropAt(
  history: readonly RatedSnapshot[],
  index: number,
): RatingDrop | null {
  const latest = history[index];
  if (!rated(latest)) return null;
  const reference = referenceOf(history, index, latest);
  if (!reference) return null;
  const dropTenths = Math.floor(
    (hundredths(reference.ratingAvg) - hundredths(latest.ratingAvg)) / 10,
  );
  if (dropTenths < 1) return null;
  return {
    from: reference.ratingAvg,
    to: latest.ratingAvg,
    fromCount: reference.ratingCount,
    toCount: latest.ratingCount,
    fromDate: utcDayOf(reference.capturedAt),
    toDate: utcDayOf(latest.capturedAt),
    dropTenths,
    version: shippedVersion(latest, reference),
  };
}

export function newRatingDrop(
  history: readonly RatedSnapshot[],
): RatingDrop | null {
  const current = ratingDropAt(history, 0);
  if (!current) return null;
  const previous = ratingDropAt(history, 1);
  return current.dropTenths > (previous?.dropTenths ?? 0) ? current : null;
}
