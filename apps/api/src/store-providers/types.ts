import { CategoryCollection, MarketAvailabilityResult } from '@asobeast/shared';
import { Store } from '@prisma/client';

export interface NormalizedApp {
  store: Store;
  storeAppId: string;
  title: string;
  subtitle?: string;
  summary?: string;
  description: string;
  iconUrl?: string;
  ratingAvg?: number;
  ratingCount?: number;
  installs?: bigint;
  price?: number;
  version?: string;
  releasedAt?: Date;
  storeUpdatedAt?: Date;
  raw: unknown;
}

export interface SearchItem {
  storeAppId: string;
  title: string;
  developer?: string;
  ratingAvg?: number;
  ratingCount?: number;
  updatedAt?: Date;
}

export interface SuggestItem {
  term: string;
  priority?: number;
}

export interface ChartItem {
  storeAppId: string;
  title: string;
}

export interface ReviewResult {
  reviewId: string;
  userName?: string;
  score: number;
  title?: string;
  text: string;
  version?: string;
  updatedAt?: Date;
}

export interface StoreProvider {
  readonly store: Store;
  getApp(storeAppId: string, country: string): Promise<NormalizedApp>;
  search(term: string, country: string, num: number): Promise<SearchItem[]>;
  suggest(term: string, country: string): Promise<SuggestItem[]>;
  similar(storeAppId: string, country: string): Promise<SearchItem[]>;
  topCharts(
    collection: CategoryCollection,
    genre: string,
    num: number,
    country: string,
  ): Promise<ChartItem[]>;
  reviews(
    storeAppId: string,
    country: string,
    page: number,
  ): Promise<ReviewResult[]>;
  availability(
    storeAppId: string,
    countries: string[],
  ): Promise<MarketAvailabilityResult[]>;
  developerApps(devId: string, country: string): Promise<SearchItem[]>;
}
