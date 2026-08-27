import {
  app,
  availability,
  NotFoundError,
  developer,
  reviews,
  search,
  similar,
  sort,
  suggest,
  list,
  collection,
} from '@mradex77/google-play-scraper';
import { egressFetch } from './egress/egress';

export function isMissingApp(error: unknown): boolean {
  return error instanceof NotFoundError;
}

export interface GooglePlayAppResult {
  appId: string;
  title: string;
  summary?: string;
  description: string;
  icon: string;
  score?: number;
  ratings?: number;
  minInstalls?: number;
  price: number;
  version: string;
  released?: string;
  updated: number;
  genre: string;
  genreId: string;
  screenshots: string[];
  video?: string;
  recentChanges?: string;
  contentRating?: string;
}

export interface GooglePlaySearchResult {
  appId: string;
  title: string;
  developer: string;
  score?: number;
}

export interface GooglePlayReviewResult {
  id: string;
  userName: string;
  date: string;
  score: number;
  title: string | null;
  text: string;
  version?: string | null;
}

export interface GooglePlayReviewsPage {
  data: GooglePlayReviewResult[];
  nextPaginationToken: string | null;
}

export type GooglePlayCountryAvailability =
  | { status: 'available' }
  | { status: 'unavailable' }
  | { status: 'error'; message: string };

export interface GooglePlayAvailabilityResult {
  appId: string;
  countries: Record<string, GooglePlayCountryAvailability>;
}

export interface GooglePlayLib {
  app(options: {
    appId: string;
    country: string;
    lang: string;
  }): Promise<GooglePlayAppResult>;
  search(options: {
    term: string;
    country: string;
    lang: string;
    num: number;
  }): Promise<GooglePlaySearchResult[]>;
  suggest(options: {
    term: string;
    country: string;
    lang: string;
  }): Promise<string[]>;
  similar(options: {
    appId: string;
    country: string;
    lang: string;
  }): Promise<GooglePlaySearchResult[]>;
  list(options: {
    collection: string;
    category: string;
    num: number;
    country: string;
    lang: string;
  }): Promise<GooglePlaySearchResult[]>;
  reviews(options: {
    appId: string;
    country: string;
    lang: string;
    num: number;
    paginate: true;
    nextPaginationToken?: string;
  }): Promise<GooglePlayReviewsPage>;
  availability(options: {
    appId: string;
    countries: string[];
    lang: string;
  }): Promise<GooglePlayAvailabilityResult>;
  developer(options: {
    devId: string;
    country: string;
    lang: string;
    num: number;
  }): Promise<GooglePlaySearchResult[]>;
}

export const GOOGLE_PLAY_LIB = Symbol('GOOGLE_PLAY_LIB');
export const GPLAY_COLLECTIONS = collection;
export const GPLAY_SORT = sort;

const overEgress = <T extends object>(options: T) => ({
  ...options,
  requestOptions: { fetchImpl: egressFetch },
});

export const googlePlayLib: GooglePlayLib = {
  app: (options) => app(overEgress(options)),
  search: (options) => search(overEgress(options)),
  suggest: (options) => suggest(overEgress(options)),
  similar: (options) => similar(overEgress(options)),
  list: (options) => list(overEgress(options) as Parameters<typeof list>[0]),
  reviews: (options) =>
    reviews(overEgress(options)) as Promise<GooglePlayReviewsPage>,
  availability: (options) => availability(overEgress(options)),
  developer: (options) => developer(overEgress(options)),
};
