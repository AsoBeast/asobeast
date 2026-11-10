import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  AppStoreLocalization,
  CategoryCollection,
  CHART_DEPTH,
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
  isMissingApp,
} from './app-store.lib';
import { lookupLanguage, pageLanguage } from './app-store-languages';
import {
  AppStorePageExtract,
  parseAppStorePageDocument,
} from './app-store-page';
import { StoreAppNotFoundError, StoreRequestError } from './errors';
import { listedInIphoneSearch } from './iphone-search';
import { ownSubtitle } from './own-subtitle';
import { Abortable, pause, storeDeadline } from './store-deadline';
import {
  ChartItem,
  NormalizedApp,
  ReviewResult,
  SearchItem,
  StoreProvider,
  SuggestItem,
} from './types';
import { toChartItem } from './chart-item';

const RETRY_DELAYS_MS = [2000, 5000];

const COLLECTION_CONSTANTS: Record<CategoryCollection, string> = {
  free: 'topfreeapplications',
  paid: 'toppaidapplications',
  grossing: 'topgrossingapplications',
};

interface PageRead {
  subtitle?: string;
  subtitleUnavailable: boolean;
  pageUnavailable: boolean;
  extract?: AppStorePageExtract;
  extractUnavailable: boolean;
}

@Injectable()
export class AppStoreProvider implements StoreProvider {
  readonly store = Store.APP_STORE;
  private readonly logger = new Logger(AppStoreProvider.name);

  constructor(@Inject(APP_STORE_LIB) private readonly lib: AppStoreLib) {}

  async getApp(
    storeAppId: string,
    country: string,
    localization?: AppStoreLocalization,
  ): Promise<NormalizedApp> {
    const raw = await this.withRetry(
      'getApp',
      (deadline) =>
        this.lib.app({
          id: Number(storeAppId),
          country,
          ratings: true,
          ...deadline,
          ...(localization ? { lang: lookupLanguage(localization) } : {}),
        }),
      storeAppId,
    );
    const read: PageRead =
      raw.subtitle === undefined
        ? await this.readPage(storeAppId, country, localization)
        : {
            subtitle: raw.subtitle,
            subtitleUnavailable: false,
            pageUnavailable: false,
            extractUnavailable: false,
          };
    return this.toNormalizedApp(raw, read);
  }

  async search(
    term: string,
    country: string,
    num: number,
  ): Promise<SearchItem[]> {
    const results = await this.withRetry('search', (deadline) =>
      this.lib.search({ term, country, num, ...deadline }),
    );
    return results.map((item) => this.toSearchItem(item));
  }

  async suggest(term: string, country: string): Promise<SuggestItem[]> {
    const results = await this.withRetry('suggest', (deadline) =>
      this.lib.suggest({ term, country, ...deadline }),
    );
    return results.map(({ term, priority }) => ({ term, priority }));
  }

  async similar(storeAppId: string, country: string): Promise<SearchItem[]> {
    const results = await this.withRetry('similar', (deadline) =>
      this.lib.similar({ id: Number(storeAppId), country, ...deadline }),
    );
    return results.map((item) => this.toSearchItem(item));
  }

  async topCharts(
    collection: CategoryCollection,
    genre: string,
    num: number,
    country: string,
  ): Promise<ChartItem[]> {
    const results = await this.withRetry('topCharts', (deadline) =>
      this.lib.list({
        collection: COLLECTION_CONSTANTS[collection],
        ...(genre === OVERALL_GENRE ? {} : { category: Number(genre) }),
        num: Math.min(num, CHART_DEPTH.APP_STORE),
        country,
        fullDetail: false,
        ...deadline,
      }),
    );
    return results.map((item) =>
      toChartItem({
        storeAppId: String(item.id),
        title: item.title,
        developer: item.developer,
        iconUrl: item.icon,
        genreId: item.genreId,
        free: item.free,
      }),
    );
  }

  async reviews(
    storeAppId: string,
    country: string,
    page: number,
  ): Promise<ReviewResult[]> {
    const clampedPage = Math.min(Math.max(page, 1), 10);
    const results = await this.withRetry('reviews', (deadline) =>
      this.lib.reviews({
        id: Number(storeAppId),
        country,
        page: clampedPage,
        ...deadline,
      }),
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
    const results = await this.withRetry('developerApps', (deadline) =>
      this.lib.developer({ devId: Number(devId), country, ...deadline }),
    );
    return results.map((item) => this.toSearchItem(item));
  }

  private async probe(
    storeAppId: string,
    country: string,
  ): Promise<MarketAvailability> {
    try {
      await this.lib.app({
        id: Number(storeAppId),
        country,
        ratings: false,
        ...storeDeadline(),
      });
      return 'available';
    } catch (error) {
      if (isMissingApp(error)) {
        return 'unavailable';
      }
      this.logger.warn(
        `availability probe failed for ${storeAppId} in ${country}: ${messageOf(error)}`,
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

  private async readPage(
    storeAppId: string,
    country: string,
    localization?: AppStoreLocalization,
  ): Promise<PageRead> {
    try {
      const listing = await this.withRetry('page', async (deadline) => {
        const fetched = await this.lib.page({
          id: Number(storeAppId),
          country,
          ...deadline,
          ...(localization ? { language: pageLanguage(localization) } : {}),
        });
        deadline.signal?.throwIfAborted();
        return listingOf(fetched);
      });
      const extract = this.pageExtractOf(storeAppId, listing.document);
      return {
        ...(listing.subtitle !== undefined
          ? { subtitle: listing.subtitle }
          : {}),
        subtitleUnavailable: listing.listingUnavailable,
        pageUnavailable: false,
        ...(extract !== undefined ? { extract } : {}),
        extractUnavailable: extract === undefined,
      };
    } catch (error) {
      this.logger.warn(
        `subtitle scrape failed for ${storeAppId}: ${messageOf(error)}`,
      );
      return {
        subtitleUnavailable: true,
        pageUnavailable: true,
        extractUnavailable: true,
      };
    }
  }

  private pageExtractOf(
    storeAppId: string,
    document: cheerio.CheerioAPI,
  ): AppStorePageExtract | undefined {
    try {
      return parseAppStorePageDocument(document);
    } catch (error) {
      this.logger.warn(
        `page extract unavailable for ${storeAppId}: ${messageOf(error)}`,
      );
      return undefined;
    }
  }

  private toNormalizedApp(
    raw: AppStoreAppResult,
    read: PageRead,
  ): NormalizedApp {
    return {
      store: this.store,
      storeAppId: String(raw.trackId ?? raw.id),
      title: raw.title,
      subtitle:
        ownSubtitle(this.store, { subtitle: read.subtitle, raw }) ?? undefined,
      subtitleUnavailable: read.subtitleUnavailable,
      pageUnavailable: read.pageUnavailable,
      ...(read.extract !== undefined ? { pageExtract: read.extract } : {}),
      pageExtractUnavailable: read.extractUnavailable,
      description: raw.description,
      iconUrl: raw.icon,
      ratingAvg: raw.score,
      ratingCount: raw.reviews ?? raw.currentVersionReviews,
      price: raw.price,
      version: raw.version,
      releasedAt: toDate(raw.released),
      storeUpdatedAt: toDate(raw.updated),
      raw,
      searchable: listedInIphoneSearch(raw.supportedDevices),
    };
  }

  private toSearchItem(item: AppStoreSearchResult): SearchItem {
    return {
      storeAppId: String(item.trackId ?? item.id),
      title: item.title,
      developer: item.developer,
      ...(item.icon ? { iconUrl: item.icon } : {}),
      ratingAvg: item.score,
      ratingCount: item.reviews ?? item.currentVersionReviews,
      ...(item.primaryGenreId === undefined
        ? {}
        : { genreId: String(item.primaryGenreId) }),
      releasedAt: toDate(item.released),
      updatedAt: toDate(item.updated),
    };
  }

  private async withRetry<T>(
    method: string,
    call: (deadline: Abortable) => Promise<T>,
    missingAppId?: string,
  ): Promise<T> {
    const deadline = storeDeadline();
    let lastError: unknown;
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        deadline.signal?.throwIfAborted();
        const result = await call(deadline);
        deadline.signal?.throwIfAborted();
        return result;
      } catch (error) {
        lastError = error;
        const delay = RETRY_DELAYS_MS[attempt];
        if (delay === undefined || !(await pause(delay, deadline.signal))) {
          break;
        }
      }
    }
    if (missingAppId !== undefined && isMissingApp(lastError)) {
      throw new StoreAppNotFoundError(this.store, missingAppId);
    }
    throw new StoreRequestError(this.store, method, messageOf(lastError));
  }
}

interface PageListing {
  document: cheerio.CheerioAPI;
  subtitle?: string;
  listingUnavailable: boolean;
}

function listingOf(html: string): PageListing {
  const document = cheerio.load(html);
  if (document('h1').length === 0) {
    return { document, listingUnavailable: true };
  }
  const text = document('p.subtitle').first().text().trim();
  return {
    document,
    ...(text.length > 0 ? { subtitle: text } : {}),
    listingUnavailable: false,
  };
}

function toDate(value?: string): Date | undefined {
  return value ? new Date(value) : undefined;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
