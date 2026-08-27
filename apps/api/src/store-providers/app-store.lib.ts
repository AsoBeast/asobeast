import * as appStore from '@perttu/app-store-scraper';
import { egressFetch } from './egress/egress';

const MISSING_APP_PATTERN = /^app not found/i;

export function isMissingApp(error: unknown): boolean {
  return MISSING_APP_PATTERN.test(
    error instanceof Error ? error.message : String(error),
  );
}

export interface AppStoreAppResult {
  id?: number | string;
  trackId?: number | string;
  title: string;
  subtitle?: string;
  description: string;
  icon?: string;
  score?: number;
  reviews?: number;
  currentVersionReviews?: number;
  price?: number;
  version?: string;
  released?: string;
  updated?: string;
}

export interface AppStoreSearchResult {
  id?: number | string;
  trackId?: number | string;
  title: string;
  developer?: string;
  score?: number;
  reviews?: number;
  currentVersionReviews?: number;
  updated?: string;
}

export interface AppStoreSuggestResult {
  term: string;
  priority?: number;
}

export interface AppStoreListResult {
  id: number | string;
  appId?: string;
  title: string;
}

export interface AppStoreListOptions {
  collection: string;
  category?: number;
  num: number;
  country: string;
}

export interface AppStoreReviewResult {
  id: string;
  userName?: string;
  version?: string;
  score: number;
  title?: string;
  text: string;
  updated?: string;
}

export interface AppStoreLib {
  app(options: {
    id: number;
    country: string;
    ratings: boolean;
  }): Promise<AppStoreAppResult>;
  page(options: { id: number; country: string }): Promise<string>;
  search(options: {
    term: string;
    country: string;
    num: number;
  }): Promise<AppStoreSearchResult[]>;
  suggest(options: {
    term: string;
    country: string;
  }): Promise<AppStoreSuggestResult[]>;
  similar(options: {
    id: number;
    country: string;
  }): Promise<AppStoreSearchResult[]>;
  list(options: AppStoreListOptions): Promise<AppStoreListResult[]>;
  reviews(options: {
    id: number;
    country: string;
    page: number;
  }): Promise<AppStoreReviewResult[]>;
  developer(options: {
    devId: number;
    country: string;
  }): Promise<AppStoreSearchResult[]>;
}

export const APP_STORE_LIB = Symbol('APP_STORE_LIB');

const PAGE_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

export const appStoreLib: AppStoreLib = {
  app: (options) => appStore.app(options),
  page: async ({ id, country }) => {
    const url = `https://apps.apple.com/${country}/app/id${id}`;
    const response = await egressFetch(url, {
      headers: { 'User-Agent': PAGE_USER_AGENT },
    });
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    return response.text();
  },
  search: (options) =>
    appStore.search(options) as Promise<AppStoreSearchResult[]>,
  suggest: (options) => appStore.suggest(options),
  similar: (options) => appStore.similar(options),
  list: (options) =>
    appStore.list(options as Parameters<typeof appStore.list>[0]),
  reviews: ({ id, country, page }) =>
    appStore.reviews({
      id,
      country,
      page,
      sort: appStore.sort.RECENT,
    }),
  developer: (options) => appStore.developer(options),
};
