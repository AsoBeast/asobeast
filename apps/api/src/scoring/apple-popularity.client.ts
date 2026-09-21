import { normalizeText } from '@asobeast/shared';
import {
  AppleAdsApi,
  createAppleAdsApi,
  FilterOperatorEnum,
  KeyAuthOptions,
  SearchTermPopularityQueryRequest,
  SearchTermPopularityRow,
  SearchTermPopularityTimeRangeGranularityEnum,
  SortingOrderEnum,
} from '@apple/apple-ads-platform';
import type { Env } from '../config/env';
import { ApplePopularityClient, PopularityRow } from './apple-popularity';

export const PAGE_SIZE = 5000;
export const MAX_PAGES = 10;
export const RATE_LIMIT_MAX_WAIT_MS = 16_000;
const API_TIMEOUT_MS = 30_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_DAYS = 7;
const RETRIED = 'asobeastRateLimitRetried';

export type PopularityApi = Pick<
  AppleAdsApi,
  'getUserAcls' | 'searchTermPopularityQuery'
>;

type ApiAxiosInstance = Parameters<
  NonNullable<KeyAuthOptions['apiAxiosCustomizer']>
>[0];

type AppleAdsCredentials = Pick<
  Env,
  | 'APPLE_ADS_CLIENT_ID'
  | 'APPLE_ADS_TEAM_ID'
  | 'APPLE_ADS_KEY_ID'
  | 'APPLE_ADS_PRIVATE_KEY_PATH'
  | 'APPLE_ADS_AD_ACCOUNT_ID'
>;

export class ApplePopularityError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ApplePopularityError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const statusOf = (error: unknown): number | undefined =>
  isRecord(error) && typeof error.status === 'number'
    ? error.status
    : undefined;

function requireSunday(week: string): Date {
  const start = new Date(`${week}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week) || start.getUTCDay() !== 0) {
    throw new RangeError(`${week} is not a Sunday`);
  }
  return start;
}

const dateKey = (date: Date): string => date.toISOString().slice(0, 10);

function popularityQuery(
  country: string,
  start: Date,
  offset: number,
): SearchTermPopularityQueryRequest {
  return {
    filters: [
      {
        field: 'countryOrRegion',
        operator: FilterOperatorEnum.Equals,
        value: country.toUpperCase(),
      },
    ],
    timeRange: {
      start: dateKey(start),
      end: dateKey(new Date(start.getTime() + (WEEK_DAYS - 1) * DAY_MS)),
      granularity: SearchTermPopularityTimeRangeGranularityEnum.WeeklySunSat,
    },
    sorting: [
      { field: 'searchPopularity1to100', order: SortingOrderEnum.Desc },
    ],
    pagination: { offset, pageSize: PAGE_SIZE },
  };
}

function toPopularityRow(
  country: string,
  row: SearchTermPopularityRow,
): PopularityRow[] {
  const term = normalizeText(row.searchTerm ?? '');
  const popularity = row.searchPopularity1to100;
  if (
    term.length === 0 ||
    !row.week ||
    typeof popularity !== 'number' ||
    !Number.isFinite(popularity)
  ) {
    return [];
  }
  return [
    {
      country,
      term,
      week: row.week,
      genre: row.genre ?? '',
      rankInGenre: row.rankInGenre ?? null,
      popularity,
      popularityInGenre: row.searchPopularityInGenre ?? null,
    },
  ];
}

export class AppleAdsPopularityClient extends ApplePopularityClient {
  readonly enabled = true;
  private api: Promise<PopularityApi> | null = null;
  private context: Promise<string> | null = null;

  constructor(
    private readonly connect: () => Promise<PopularityApi>,
    private readonly adAccountId?: string,
  ) {
    super();
  }

  async weekOf(country: string, week: string): Promise<PopularityRow[]> {
    const start = requireSunday(week);
    const storefront = country.toLowerCase();
    try {
      const api = await this.connected();
      const context = await this.adAccountContext(api);
      const rows: PopularityRow[] = [];
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const response = await api.searchTermPopularityQuery(
          context,
          popularityQuery(storefront, start, page * PAGE_SIZE),
        );
        const found = response.data.result?.rows ?? [];
        rows.push(...found.flatMap((row) => toPopularityRow(storefront, row)));
        if (found.length < PAGE_SIZE) {
          break;
        }
      }
      return rows;
    } catch (error) {
      if (error instanceof ApplePopularityError) {
        throw error;
      }
      const status = statusOf(error);
      throw new ApplePopularityError(
        `Apple Ads search popularity request failed${status === undefined ? '' : ` with status ${status}`}`,
        status,
      );
    }
  }

  private connected(): Promise<PopularityApi> {
    this.api ??= this.connect().catch((error: unknown) => {
      this.api = null;
      throw error;
    });
    return this.api;
  }

  private adAccountContext(api: PopularityApi): Promise<string> {
    this.context ??= this.resolveAdAccount(api).catch((error: unknown) => {
      this.context = null;
      throw error;
    });
    return this.context;
  }

  private async resolveAdAccount(api: PopularityApi): Promise<string> {
    if (this.adAccountId) {
      return `adAccountId=${this.adAccountId}`;
    }
    const response = await api.getUserAcls();
    const id = response.data.result?.acls?.[0]?.adAccount?.id;
    if (id === undefined) {
      throw new ApplePopularityError(
        'Apple Ads returned no ad account for these credentials',
      );
    }
    return `adAccountId=${id}`;
  }
}

function retryAfterMs(header: unknown): number {
  if (typeof header !== 'string') {
    return RATE_LIMIT_MAX_WAIT_MS;
  }
  const seconds = Number(header);
  const wait = Number.isFinite(seconds)
    ? seconds * 1000
    : Date.parse(header) - Date.now();
  return Number.isFinite(wait)
    ? Math.min(Math.max(wait, 0), RATE_LIMIT_MAX_WAIT_MS)
    : RATE_LIMIT_MAX_WAIT_MS;
}

const sleepFor = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function retryRateLimitedOnce(
  instance: ApiAxiosInstance,
  sleep: (ms: number) => Promise<void> = sleepFor,
): void {
  instance.interceptors.response.use(undefined, async (error: unknown) => {
    const response = isRecord(error) ? error.response : undefined;
    const config = isRecord(error) ? error.config : undefined;
    if (
      !isRecord(response) ||
      response.status !== 429 ||
      !isRecord(config) ||
      config[RETRIED]
    ) {
      throw error;
    }
    const headers = isRecord(response.headers) ? response.headers : {};
    await sleep(retryAfterMs(headers['retry-after']));
    const retry: Record<string, unknown> = { ...config, [RETRIED]: true };
    return instance.request(retry);
  });
}

export function appleAdsPopularityClient(
  env: AppleAdsCredentials,
): AppleAdsPopularityClient {
  return new AppleAdsPopularityClient(
    () =>
      createAppleAdsApi({
        authMode: 'key',
        clientId: env.APPLE_ADS_CLIENT_ID ?? '',
        teamId: env.APPLE_ADS_TEAM_ID ?? '',
        keyId: env.APPLE_ADS_KEY_ID ?? '',
        privateKeyPath: env.APPLE_ADS_PRIVATE_KEY_PATH ?? '',
        apiTimeout: API_TIMEOUT_MS,
        apiAxiosCustomizer: (instance) => retryRateLimitedOnce(instance),
        logger: null,
      }),
    env.APPLE_ADS_AD_ACCOUNT_ID,
  );
}
