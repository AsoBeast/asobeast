import { Store } from '@asobeast/shared';

export const DAILY_WORK = [
  'apps',
  'keywords',
  'categories',
  'reviews',
] as const;

export type DailyWork = (typeof DAILY_WORK)[number];

export const APP_STORE_REQUESTS: Record<DailyWork, number> = {
  apps: 1,
  keywords: 1,
  categories: 1,
  reviews: 1,
};

export const GOOGLE_PLAY_REQUESTS: Record<DailyWork, number> = {
  apps: 1,
  keywords: 8,
  categories: 8,
  reviews: 1,
};

const BY_STORE: Record<Store, Record<DailyWork, number>> = {
  APP_STORE: APP_STORE_REQUESTS,
  GOOGLE_PLAY: GOOGLE_PLAY_REQUESTS,
};

export function requestsPerJob(store: Store, work: DailyWork): number {
  return BY_STORE[store][work];
}

export function requestsFor(
  store: Store,
  jobs: Record<DailyWork, number>,
): number {
  return DAILY_WORK.reduce(
    (total, work) => total + jobs[work] * requestsPerJob(store, work),
    0,
  );
}
