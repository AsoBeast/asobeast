import { utcDayOf } from '@asobeast/shared';

export const RATING_DROP_WINDOW_DAYS = 7;
export const RATING_DROP_REFERENCE_SLACK_DAYS = 3;
export const RATING_DROP_MIN_COUNT = 20;
export const RATING_DROP_HISTORY_DAYS =
  2 * (RATING_DROP_WINDOW_DAYS + RATING_DROP_REFERENCE_SLACK_DAYS);

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

const TENTH_TOLERANCE = 1e-9;

const wholeTenths = (from: number, to: number): number =>
  Math.floor((from - to) * 10 + TENTH_TOLERANCE);

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
  latest.version !== null &&
  reference.version !== null &&
  latest.version !== reference.version
    ? latest.version
    : null;

interface MeasuredDrop {
  drop: RatingDrop;
  reference: Rated;
}

function measuredDropAt(
  history: readonly RatedSnapshot[],
  index: number,
): MeasuredDrop | null {
  const latest = history[index];
  if (!rated(latest)) return null;
  const reference = referenceOf(history, index, latest);
  if (!reference) return null;
  const dropTenths = wholeTenths(reference.ratingAvg, latest.ratingAvg);
  if (dropTenths < 1) return null;
  return {
    reference,
    drop: {
      from: reference.ratingAvg,
      to: latest.ratingAvg,
      fromCount: reference.ratingCount,
      toCount: latest.ratingCount,
      fromDate: utcDayOf(reference.capturedAt),
      toDate: utcDayOf(latest.capturedAt),
      dropTenths,
      version: shippedVersion(latest, reference),
    },
  };
}

export function ratingDropAt(
  history: readonly RatedSnapshot[],
  index: number,
): RatingDrop | null {
  return measuredDropAt(history, index)?.drop ?? null;
}

function deepestShownSince(
  history: readonly RatedSnapshot[],
  reference: Rated,
): number {
  return history.reduce((deepest, snapshot, index) => {
    if (index === 0 || snapshot.capturedAt <= reference.capturedAt) {
      return deepest;
    }
    const earlier = ratingDropAt(history, index);
    return earlier
      ? Math.max(deepest, wholeTenths(reference.ratingAvg, earlier.to))
      : deepest;
  }, 0);
}

export function newRatingDrop(
  history: readonly RatedSnapshot[],
): RatingDrop | null {
  const current = measuredDropAt(history, 0);
  if (!current) return null;
  return current.drop.dropTenths > deepestShownSince(history, current.reference)
    ? current.drop
    : null;
}
