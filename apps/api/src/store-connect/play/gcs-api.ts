import {
  GOOGLE_TOKEN_AUDIENCE,
  GoogleTokenCache,
  type GoogleTokenAnswer,
  type ServiceAccount,
} from './service-account';
import type { GcsResponse, GcsTransport } from './gcs-transport';

export const GCS_ORIGIN = 'https://storage.googleapis.com';
export const STORE_PERFORMANCE_PREFIX = 'stats/store_performance/';
const JWT_GRANT = 'urn:ietf:params:oauth:grant-type:jwt-bearer';
const LIST_FIELDS = 'nextPageToken,items(name,size,md5Hash,updated,generation)';

export interface GcsOrigins {
  token: string;
  storage: string;
}

export const GOOGLE_ORIGINS: GcsOrigins = {
  token: GOOGLE_TOKEN_AUDIENCE,
  storage: GCS_ORIGIN,
};

export interface GcsObject {
  name: string;
  size: number;
  md5Hash: string | null;
  generation: string;
  updated: string;
}

export class GcsError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class GcsRejectedError extends GcsError {}

export class GcsBucketError extends GcsError {}

export class GcsRateLimitedError extends GcsError {}

function errorOf(response: GcsResponse, what: string): GcsError {
  const message = `Google answered ${response.status} to ${what}`;
  if (response.status === 404) return new GcsBucketError(message, 404);
  if (response.status === 429) return new GcsRateLimitedError(message, 429);
  if ([400, 401, 403].includes(response.status)) {
    return new GcsRejectedError(message, response.status);
  }
  return new GcsError(message, response.status);
}

interface ListPage {
  items?: {
    name?: string;
    size?: string;
    md5Hash?: string;
    generation?: string;
    updated?: string;
  }[];
  nextPageToken?: string;
}

const isSuccess = (response: GcsResponse): boolean =>
  response.status >= 200 && response.status < 300;

export class GcsApi {
  private readonly tokens: GoogleTokenCache;

  constructor(
    private readonly transport: GcsTransport,
    account: ServiceAccount,
    private readonly bucket: string,
    private readonly origins: GcsOrigins = GOOGLE_ORIGINS,
  ) {
    this.tokens = new GoogleTokenCache(account, (assertion) =>
      this.exchange(assertion),
    );
  }

  async listStorePerformance(): Promise<GcsObject[]> {
    const objects: GcsObject[] = [];
    let pageToken: string | undefined;
    do {
      const query = new URLSearchParams({
        prefix: STORE_PERFORMANCE_PREFIX,
        fields: LIST_FIELDS,
        ...(pageToken ? { pageToken } : {}),
      });
      const response = await this.transport({
        method: 'GET',
        url: `${this.origins.storage}/storage/v1/b/${encodeURIComponent(this.bucket)}/o?${query.toString()}`,
        bearer: await this.tokens.get(),
      });
      if (!isSuccess(response)) throw errorOf(response, 'the bucket listing');
      const page = (response.body ?? {}) as ListPage;
      for (const item of page.items ?? []) {
        if (!item.name || !item.generation) continue;
        objects.push({
          name: item.name,
          size: Number(item.size ?? 0),
          md5Hash: item.md5Hash ?? null,
          generation: item.generation,
          updated: item.updated ?? '',
        });
      }
      pageToken = page.nextPageToken;
    } while (pageToken);
    return objects;
  }

  async download(name: string): Promise<Buffer> {
    const response = await this.transport({
      method: 'GET',
      url: `${this.origins.storage}/storage/v1/b/${encodeURIComponent(this.bucket)}/o/${encodeURIComponent(name)}?alt=media`,
      bearer: await this.tokens.get(),
      binary: true,
    });
    if (!isSuccess(response)) throw errorOf(response, `the file ${name}`);
    return response.bytes ?? Buffer.alloc(0);
  }

  private async exchange(assertion: string): Promise<GoogleTokenAnswer> {
    const response = await this.transport({
      method: 'POST',
      url: this.origins.token,
      form: { grant_type: JWT_GRANT, assertion },
    });
    if (!isSuccess(response)) throw errorOf(response, 'the token request');
    const answer = response.body as Partial<GoogleTokenAnswer> | null;
    if (!answer?.access_token) {
      throw new GcsRejectedError('Google answered no access token', 400);
    }
    return {
      access_token: answer.access_token,
      expires_in: answer.expires_in ?? 3600,
    };
  }
}

export interface MonthFiles {
  country: GcsObject | null;
  traffic: GcsObject | null;
}

export function storePerformanceObjects(
  objects: GcsObject[],
  packageName: string,
  month: string,
): MonthFiles {
  const name = (breakdown: string) =>
    `${STORE_PERFORMANCE_PREFIX}store_performance_${packageName}_${month}_${breakdown}.csv`;
  const find = (breakdown: string) =>
    objects.find((object) => object.name === name(breakdown)) ?? null;
  return { country: find('country'), traffic: find('traffic_source') };
}
