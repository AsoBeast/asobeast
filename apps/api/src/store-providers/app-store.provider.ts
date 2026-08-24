import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  CategoryCollection,
  MarketAvailability,
  MarketAvailabilityResult,
  OVERALL_GENRE,
} from '@asobeast/shared';
import { Store } from '@prisma/client';
import * as cheerio from 'cheerio';
import {
  APP_STORE_LIB,
  AppStoreAppResult,
  AppStoreLib,
  AppStoreReviewResult,
  AppStoreSearchResult,
} from './app-store.lib';
import { StoreRequestError } from './errors';
import {
  ChartItem,
  NormalizedApp,
  ReviewResult,
  SearchItem,
  StoreProvider,
  SuggestItem,
} from './types';

const RETRY_DELAYS_MS = [2000, 5000];
const CHART_MAX = 200;
const NOT_FOUND_PATTERN = /not found/i;

const COLLECTION_CONSTANTS: Record<CategoryCollection, string> = {
  free: 'topfreeapplications',
  paid: 'toppaidapplications',
  grossing: 'topgrossingapplications',
};

@Injectable()
export class AppStoreProvider implements StoreProvider {
  readonly store = Store.APP_STORE;
  private readonly logger = new Logger(AppStoreProvider.name);

  constructor(@Inject(APP_STORE_LIB) private readonly lib: AppStoreLib) {}

  async getApp(storeAppId: string, country: string): Promise<NormalizedApp> {
    const raw = await this.withRetry('getApp', () =>
      this.lib.app({ id: Number(storeAppId), country, ratings: true }),
    );
    const subtitle =
      raw.subtitle ?? (await this.fetchSubtitle(storeAppId, country));
    return this.toNormalizedApp(raw, subtitle);
  }

  async search(
    term: string,
    country: string,
    num: number,
  ): Promise<SearchItem[]> {
    const results = await this.withRetry('search', () =>
      this.lib.search({ term, country, num }),
    );
    return results.map((item) => this.toSearchItem(item));
  }

  async suggest(term: string, country: string): Promise<SuggestItem[]> {
    const results = await this.withRetry('suggest', () =>
      this.lib.suggest({ term, country }),
    );
    return results.map(({ term, priority }) => ({ term, priority }));
  }

  async similar(storeAppId: string, country: string): Promise<SearchItem[]> {
    const results = await this.withRetry('similar', () =>
      this.lib.similar({ id: Number(storeAppId), country }),
    );
    return results.map((item) => this.toSearchItem(item));
  }

  async topCharts(
    collection: CategoryCollection,
    genre: string,
    num: number,
    country: string,
  ): Promise<ChartItem[]> {
    const results = await this.withRetry('topCharts', () =>
      this.lib.list({
        collection: COLLECTION_CONSTANTS[collection],
        ...(genre === OVERALL_GENRE ? {} : { category: Number(genre) }),
        num: Math.min(num, CHART_MAX),
        country,
      }),
    );
    return results.map((item) => ({
      storeAppId: String(item.id),
      title: item.title,
    }));
  }

  async reviews(
    storeAppId: string,
    country: string,
    page: number,
  ): Promise<ReviewResult[]> {
    const clampedPage = Math.min(Math.max(page, 1), 10);
    const results = await this.withRetry('reviews', () =>
      this.lib.reviews({ id: Number(storeAppId), country, page: clampedPage }),
    );
    return results.map((item) => this.toReviewResult(item));
  }

  async availability(
    storeAppId: string,
    countries: string[],
  ): Promise<MarketAvailabilityResult[]> {
    const results: MarketAvailabilityResult[] = [];
    for (const country of countries) {
      results.push({
        country,
        status: await this.probe(storeAppId, country),
      });
    }
    return results;
  }

  async developerApps(devId: string, country: string): Promise<SearchItem[]> {
    const results = await this.withRetry('developerApps', () =>
      this.lib.developer({ devId: Number(devId), country }),
    );
    return results.map((item) => this.toSearchItem(item));
  }

  private async probe(
    storeAppId: string,
    country: string,
  ): Promise<MarketAvailability> {
    try {
      await this.lib.app({ id: Number(storeAppId), country, ratings: false });
      return 'available';
    } catch (error) {
      const message = messageOf(error);
      if (NOT_FOUND_PATTERN.test(message)) {
        return 'unavailable';
      }
      this.logger.warn(
        `availability probe failed for ${storeAppId} in ${country}: ${message}`,
      );
      return 'unknown';
    }
  }

  private toReviewResult(item: AppStoreReviewResult): ReviewResult {
    return {
      reviewId: item.id,
      userName: item.userName,
      score: item.score,
      title: item.title,
      text: item.text,
      version: item.version,
      updatedAt: toDate(item.updated),
    };
  }

  private async fetchSubtitle(
    storeAppId: string,
    country: string,
  ): Promise<string | undefined> {
    try {
      const html = await this.withRetry('page', () =>
        this.lib.page({ id: Number(storeAppId), country }),
      );
      const text = cheerio.load(html)('p.subtitle').first().text().trim();
      return text.length > 0 ? text : undefined;
    } catch (error) {
      this.logger.warn(
        `subtitle scrape failed for ${storeAppId}: ${messageOf(error)}`,
      );
      return undefined;
    }
  }

  private toNormalizedApp(
    raw: AppStoreAppResult,
    subtitle: string | undefined,
  ): NormalizedApp {
    return {
      store: this.store,
      storeAppId: String(raw.trackId ?? raw.id),
      title: raw.title,
      subtitle,
      description: raw.description,
      iconUrl: raw.icon,
      ratingAvg: raw.score,
      ratingCount: raw.reviews ?? raw.currentVersionReviews,
      price: raw.price,
      version: raw.version,
      releasedAt: toDate(raw.released),
      storeUpdatedAt: toDate(raw.updated),
      raw,
    };
  }

  private toSearchItem(item: AppStoreSearchResult): SearchItem {
    return {
      storeAppId: String(item.trackId ?? item.id),
      title: item.title,
      developer: item.developer,
      ratingAvg: item.score,
      ratingCount: item.reviews ?? item.currentVersionReviews,
      updatedAt: toDate(item.updated),
    };
  }

  private async withRetry<T>(
    method: string,
    call: () => Promise<T>,
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        return await call();
      } catch (error) {
        lastError = error;
        const delay = RETRY_DELAYS_MS[attempt];
        if (delay === undefined) break;
        await sleep(delay);
      }
    }
    throw new StoreRequestError(this.store, method, messageOf(lastError));
  }
}

function toDate(value?: string): Date | undefined {
  return value ? new Date(value) : undefined;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
