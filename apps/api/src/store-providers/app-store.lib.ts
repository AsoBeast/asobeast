import { randomUUID } from 'node:crypto';
import * as appStore from '@perttu/app-store-scraper';
import { parseReviewsFeed, reviewsFeedUrl } from './app-store-reviews-feed';
import { egressFetch } from './egress/egress';
import { Abortable } from './store-deadline';

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
  supportedDevices?: string[];
}

export interface AppStoreSearchResult {
  id?: number | string;
  trackId?: number | string;
  title: string;
  developer?: string;
  score?: number;
  reviews?: number;
  currentVersionReviews?: number;
  primaryGenreId?: number | string;
  released?: string;
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

export interface AppStoreListOptions extends Abortable {
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
  app(
    options: {
      id: number;
      country: string;
      ratings: boolean;
      lang?: string;
    } & Abortable,
  ): Promise<AppStoreAppResult>;
  page(
    options: {
      id: number;
      country: string;
      language?: string;
    } & Abortable,
  ): Promise<string>;
  search(
    options: {
      term: string;
      country: string;
      num: number;
    } & Abortable,
  ): Promise<AppStoreSearchResult[]>;
  suggest(
    options: {
      term: string;
      country: string;
    } & Abortable,
  ): Promise<AppStoreSuggestResult[]>;
  similar(
    options: {
      id: number;
      country: string;
    } & Abortable,
  ): Promise<AppStoreSearchResult[]>;
  list(options: AppStoreListOptions): Promise<AppStoreListResult[]>;
  reviews(
    options: {
      id: number;
      country: string;
      page: number;
    } & Abortable,
  ): Promise<AppStoreReviewResult[]>;
  developer(
    options: {
      devId: number;
      country: string;
    } & Abortable,
  ): Promise<AppStoreSearchResult[]>;
}

export const APP_STORE_LIB = Symbol('APP_STORE_LIB');

const PAGE_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

const REVIEWS_USER_AGENT = 'iTunes/12.11 (Macintosh; OS X 10.15.7)';

async function fetchText(
  url: string,
  userAgent: string,
  signal?: AbortSignal,
): Promise<string> {
  const response = await egressFetch(url, {
    headers: { 'User-Agent': userAgent },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return response.text();
}

const pageUrl = (id: number, country: string, language?: string): string => {
  const url = new URL(`https://apps.apple.com/${country}/app/id${id}`);
  if (language !== undefined) url.searchParams.set('l', language);
  return url.toString();
};

const withSignal = <T extends Abortable>({ signal, ...options }: T) => ({
  ...options,
  requestOptions: { signal },
});

export const appStoreLib: AppStoreLib = {
  app: (options) => appStore.app(withSignal(options)),
  page: ({ id, country, language, signal }) =>
    fetchText(pageUrl(id, country, language), PAGE_USER_AGENT, signal),
  search: (options) =>
    appStore.search(withSignal(options)) as Promise<AppStoreSearchResult[]>,
  suggest: (options) => appStore.suggest(withSignal(options)),
  similar: (options) => appStore.similar(withSignal(options)),
  list: (options) =>
    appStore.list(withSignal(options) as Parameters<typeof appStore.list>[0]),
  reviews: async ({ id, country, page, signal }) =>
    parseReviewsFeed(
      JSON.parse(
        await fetchText(
          reviewsFeedUrl(id, country, page, randomUUID()),
          REVIEWS_USER_AGENT,
          signal,
        ),
      ),
    ),
  developer: (options) => appStore.developer(withSignal(options)),
};
