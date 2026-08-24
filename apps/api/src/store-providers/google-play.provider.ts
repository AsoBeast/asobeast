import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  CategoryCollection,
  MarketAvailability,
  MarketAvailabilityResult,
  OVERALL_GENRE,
} from '@asobeast/shared';
import { Store } from '@prisma/client';
import { StoreRequestError } from './errors';
import {
  GOOGLE_PLAY_LIB,
  GPLAY_COLLECTIONS,
  GooglePlayCountryAvailability,
  GooglePlayLib,
  GooglePlayReviewsPage,
} from './google-play.lib';
import {
  ChartItem,
  NormalizedApp,
  ReviewResult,
  SearchItem,
  StoreProvider,
  SuggestItem,
} from './types';

const SEARCH_MAX = 250;
const CHART_MAX = 500;
const REVIEWS_PER_PAGE = 50;
const DEVELOPER_APPS_MAX = 30;

const toMarketAvailability = (
  status: GooglePlayCountryAvailability['status'] | undefined,
): MarketAvailability =>
  status === 'available' || status === 'unavailable' ? status : 'unknown';

const COLLECTION_CONSTANTS: Record<CategoryCollection, string> = {
  free: GPLAY_COLLECTIONS.TOP_FREE,
  paid: GPLAY_COLLECTIONS.TOP_PAID,
  grossing: GPLAY_COLLECTIONS.GROSSING,
};

const GPLAY_LANG_BY_COUNTRY: Record<string, string> = {
  us: 'en',
  gb: 'en',
  au: 'en',
  ca: 'en',
  ie: 'en',
  nz: 'en',
  in: 'en',
  ph: 'en',
  sg: 'en',
  za: 'en',
  de: 'de',
  at: 'de',
  ch: 'de',
  fr: 'fr',
  es: 'es',
  mx: 'es',
  ar: 'es',
  co: 'es',
  cl: 'es',
  it: 'it',
  pt: 'pt',
  br: 'pt',
  nl: 'nl',
  pl: 'pl',
  se: 'sv',
  no: 'no',
  dk: 'da',
  fi: 'fi',
  jp: 'ja',
  kr: 'ko',
  tw: 'zh',
  hk: 'zh',
  ru: 'ru',
  tr: 'tr',
  ua: 'uk',
  cz: 'cs',
  sk: 'sk',
  hu: 'hu',
  ro: 'ro',
  gr: 'el',
  il: 'he',
  sa: 'ar',
  ae: 'ar',
  eg: 'ar',
  th: 'th',
  vn: 'vi',
  id: 'id',
  my: 'ms',
};

export const googlePlayLanguage = (country: string): string =>
  GPLAY_LANG_BY_COUNTRY[country.toLowerCase()] ?? 'en';

@Injectable()
export class GooglePlayProvider implements StoreProvider {
  readonly store = Store.GOOGLE_PLAY;
  private readonly logger = new Logger(GooglePlayProvider.name);

  constructor(@Inject(GOOGLE_PLAY_LIB) private readonly lib: GooglePlayLib) {}

  async getApp(storeAppId: string, country: string): Promise<NormalizedApp> {
    const lang = googlePlayLanguage(country);
    const raw = await this.call('getApp', () =>
      this.lib.app({ appId: storeAppId, country, lang }),
    );
    return {
      store: this.store,
      storeAppId: raw.appId,
      title: raw.title,
      summary: raw.summary,
      description: raw.description,
      iconUrl: raw.icon,
      ratingAvg: raw.score,
      ratingCount: raw.ratings,
      installs:
        raw.minInstalls === undefined ? undefined : BigInt(raw.minInstalls),
      price: raw.price,
      version: raw.version,
      releasedAt: parseDate(raw.released),
      storeUpdatedAt: new Date(raw.updated),
      raw,
    };
  }

  async search(
    term: string,
    country: string,
    num: number,
  ): Promise<SearchItem[]> {
    const lang = googlePlayLanguage(country);
    const results = await this.call('search', () =>
      this.lib.search({ term, country, lang, num: Math.min(num, SEARCH_MAX) }),
    );
    return results.map((item) => this.toSearchItem(item));
  }

  async suggest(term: string, country: string): Promise<SuggestItem[]> {
    const lang = googlePlayLanguage(country);
    const results = await this.call('suggest', () =>
      this.lib.suggest({ term, country, lang }),
    );
    return results.map((suggestion) => ({ term: suggestion }));
  }

  async similar(storeAppId: string, country: string): Promise<SearchItem[]> {
    const lang = googlePlayLanguage(country);
    const results = await this.call('similar', () =>
      this.lib.similar({ appId: storeAppId, country, lang }),
    );
    return results.map((item) => this.toSearchItem(item));
  }

  async topCharts(
    collection: CategoryCollection,
    genre: string,
    num: number,
    country: string,
  ): Promise<ChartItem[]> {
    const lang = googlePlayLanguage(country);
    const category = genre === OVERALL_GENRE ? 'APPLICATION' : genre;
    const results = await this.call('topCharts', () =>
      this.lib.list({
        collection: COLLECTION_CONSTANTS[collection],
        category,
        num: Math.min(num, CHART_MAX),
        country,
        lang,
      }),
    );
    return results.map((item) => ({
      storeAppId: item.appId,
      title: item.title,
    }));
  }

  async reviews(
    storeAppId: string,
    country: string,
    page: number,
  ): Promise<ReviewResult[]> {
    const clampedPage = Math.min(Math.max(page, 1), 10);
    const lang = googlePlayLanguage(country);
    let token: string | undefined;
    let current: GooglePlayReviewsPage | null = null;
    for (let n = 1; n <= clampedPage; n++) {
      current = await this.call('reviews', () =>
        this.lib.reviews({
          appId: storeAppId,
          country,
          lang,
          num: REVIEWS_PER_PAGE,
          paginate: true,
          nextPaginationToken: token,
        }),
      );
      if (n === clampedPage) {
        break;
      }
      if (current.nextPaginationToken === null) {
        return [];
      }
      token = current.nextPaginationToken;
    }
    if (!current) {
      return [];
    }
    return current.data.map((review) => ({
      reviewId: review.id,
      userName: review.userName,
      score: review.score,
      title: review.title ?? undefined,
      text: review.text,
      version: review.version ?? undefined,
      updatedAt: new Date(review.date),
    }));
  }

  async availability(
    storeAppId: string,
    countries: string[],
  ): Promise<MarketAvailabilityResult[]> {
    const lang = googlePlayLanguage(countries[0] ?? 'us');
    try {
      const result = await this.lib.availability({
        appId: storeAppId,
        countries,
        lang,
      });
      return countries.map((country) => ({
        country,
        status: toMarketAvailability(result.countries[country]?.status),
      }));
    } catch (error) {
      this.logger.warn(
        `availability probe failed for ${storeAppId}: ${messageOf(error)}`,
      );
      return countries.map((country) => ({
        country,
        status: 'unknown' as const,
      }));
    }
  }

  async developerApps(devId: string, country: string): Promise<SearchItem[]> {
    const lang = googlePlayLanguage(country);
    const results = await this.call('developerApps', () =>
      this.lib.developer({ devId, country, lang, num: DEVELOPER_APPS_MAX }),
    );
    return results.map((item) => this.toSearchItem(item));
  }

  private toSearchItem(item: {
    appId: string;
    title: string;
    developer: string;
    score?: number;
  }): SearchItem {
    return {
      storeAppId: item.appId,
      title: item.title,
      developer: item.developer,
      ratingAvg: item.score,
    };
  }

  private async call<T>(method: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      throw new StoreRequestError(this.store, method, messageOf(error));
    }
  }
}

function parseDate(value?: string): Date | undefined {
  if (!value) {
    return undefined;
  }
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? undefined : new Date(ms);
}

function messageOf(error: unknown): string {
  return error instanceof Error
    ? `${error.name}: ${error.message}`
    : String(error);
}
