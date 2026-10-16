import { setTimeout as sleep } from 'node:timers/promises';
import { AscError, AscSegmentSizeError, errorOf } from './asc-errors';
import type { AscTokenCache } from './asc-token';
import {
  ASC_ORIGIN,
  type AscRequest,
  type AscResponse,
  type AscTransport,
} from './asc-transport';

export const ASC_PAGE_SIZE = 200;
export const ASC_RETRY_PAUSE_MS = 2_000;
export const DISCOVERY_REPORT_PREFIX = 'App Store Discovery and Engagement';
export const DISCOVERY_REPORT_CATEGORY = 'APP_STORE_ENGAGEMENT';
const DETAILED_MARKER = 'Detailed';

export type DiscoveryVariant = 'standard' | 'detailed';
export type AscAccessType = 'ONGOING' | 'ONE_TIME_SNAPSHOT';
export type AscGranularity = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface AscApp {
  id: string;
  name: string;
}

export interface AscReportRequest {
  id: string;
  accessType: AscAccessType;
  stoppedDueToInactivity: boolean;
}

export interface AscReport {
  id: string;
  name: string;
  category: string;
}

export interface AscInstance {
  id: string;
  granularity: AscGranularity;
  processingDate: string;
}

export interface AscSegment {
  id: string;
  checksum: string;
  sizeInBytes: number;
  url: string;
}

interface Resource<T> {
  id: string;
  attributes?: T;
}

interface Page<T> {
  data?: Resource<T>[];
  links?: { next?: string };
}

const chunks = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );

const isServerError = (response: AscResponse): boolean =>
  response.status >= 500;

const isSuccess = (response: AscResponse): boolean =>
  response.status >= 200 && response.status < 300;

function nextPath(next: string | undefined): string | null {
  if (!next) return null;
  const url = new URL(next);
  if (url.origin !== ASC_ORIGIN) {
    throw new AscError(
      'App Store Connect answered a next page on another host',
      502,
      null,
    );
  }
  return `${url.pathname}${url.search}`;
}

export class AscAnalyticsApi {
  constructor(
    private readonly transport: AscTransport,
    private readonly tokens: AscTokenCache,
    private readonly pause: (ms: number) => Promise<unknown> = sleep,
  ) {}

  async verify(): Promise<void> {
    await this.send({
      method: 'GET',
      path: '/v1/apps?fields[apps]=name&limit=1',
    });
  }

  async appsById(ids: string[]): Promise<AscApp[]> {
    const pages = [];
    for (const batch of chunks(ids, ASC_PAGE_SIZE)) {
      pages.push(
        ...(await this.page<{ name?: string }>(
          `/v1/apps?filter[id]=${batch.join(',')}&fields[apps]=name,bundleId&limit=${ASC_PAGE_SIZE}`,
        )),
      );
    }
    return pages.map(({ id, attributes }) => ({
      id,
      name: attributes?.name ?? id,
    }));
  }

  async reportRequests(appId: string): Promise<AscReportRequest[]> {
    const requests = await this.page<Omit<AscReportRequest, 'id'>>(
      `/v1/apps/${encodeURIComponent(appId)}/analyticsReportRequests?limit=${ASC_PAGE_SIZE}`,
    );
    return requests.map(toReportRequest);
  }

  async createReportRequest(
    appId: string,
    accessType: AscAccessType,
  ): Promise<AscReportRequest> {
    const response = await this.send({
      method: 'POST',
      path: '/v1/analyticsReportRequests',
      body: {
        data: {
          type: 'analyticsReportRequests',
          attributes: { accessType },
          relationships: { app: { data: { type: 'apps', id: appId } } },
        },
      },
    });
    const created = (
      response.body as { data?: Resource<Omit<AscReportRequest, 'id'>> }
    ).data;
    if (!created) {
      throw new AscError(
        'App Store Connect created no report request',
        502,
        null,
      );
    }
    return toReportRequest(created);
  }

  async discoveryReport(
    requestId: string,
    variant: DiscoveryVariant,
  ): Promise<AscReport | null> {
    const reports = await this.page<{ name?: string; category?: string }>(
      `/v1/analyticsReportRequests/${encodeURIComponent(requestId)}/reports?filter[category]=${DISCOVERY_REPORT_CATEGORY}&limit=${ASC_PAGE_SIZE}`,
    );
    const wanted = variant === 'detailed';
    const report = reports.find(({ attributes }) => {
      const name = attributes?.name ?? '';
      return (
        name.startsWith(DISCOVERY_REPORT_PREFIX) &&
        name.includes(DETAILED_MARKER) === wanted
      );
    });
    return report
      ? {
          id: report.id,
          name: report.attributes?.name ?? '',
          category: report.attributes?.category ?? DISCOVERY_REPORT_CATEGORY,
        }
      : null;
  }

  async dailyInstances(
    reportId: string,
    after: string | null,
  ): Promise<AscInstance[]> {
    const instances = await this.page<Omit<AscInstance, 'id'>>(
      `/v1/analyticsReports/${encodeURIComponent(reportId)}/instances?filter[granularity]=DAILY&limit=${ASC_PAGE_SIZE}`,
    );
    return instances
      .map(({ id, attributes }) => ({
        id,
        granularity: attributes?.granularity ?? 'DAILY',
        processingDate: attributes?.processingDate ?? '',
      }))
      .filter(
        ({ granularity, processingDate }) =>
          granularity === 'DAILY' &&
          processingDate.length > 0 &&
          (after === null || processingDate > after),
      )
      .sort((a, b) => a.processingDate.localeCompare(b.processingDate));
  }

  async segments(instanceId: string): Promise<AscSegment[]> {
    const segments = await this.page<Omit<AscSegment, 'id'>>(
      `/v1/analyticsReportInstances/${encodeURIComponent(instanceId)}/segments?limit=${ASC_PAGE_SIZE}`,
    );
    return segments.map(({ id, attributes }) => ({
      id,
      checksum: attributes?.checksum ?? '',
      sizeInBytes: attributes?.sizeInBytes ?? 0,
      url: attributes?.url ?? '',
    }));
  }

  async download(segment: AscSegment): Promise<Buffer> {
    if (!segment.url.startsWith('https://')) {
      throw new AscError('A report segment link is not https', 502, null);
    }
    const response = await this.send({
      method: 'GET',
      path: '',
      absoluteUrl: segment.url,
    });
    const bytes = response.bytes ?? Buffer.alloc(0);
    if (bytes.length !== segment.sizeInBytes) {
      throw new AscSegmentSizeError(segment.sizeInBytes, bytes.length);
    }
    return bytes;
  }

  private async page<T>(path: string): Promise<Resource<T>[]> {
    const items: Resource<T>[] = [];
    let next: string | null = path;
    while (next) {
      const response = await this.send({ method: 'GET', path: next });
      const page = (response.body ?? {}) as Page<T>;
      items.push(...(page.data ?? []));
      next = nextPath(page.links?.next);
    }
    return items;
  }

  private async send(request: AscRequest): Promise<AscResponse> {
    const signed =
      request.absoluteUrl === undefined
        ? { ...request, token: this.tokens.get() }
        : request;
    let response = await this.transport(signed);
    if (isServerError(response)) {
      await this.pause(ASC_RETRY_PAUSE_MS);
      response = await this.transport(signed);
    }
    if (!isSuccess(response)) throw errorOf(response, request);
    return response;
  }
}

function toReportRequest({
  id,
  attributes,
}: Resource<Omit<AscReportRequest, 'id'>>): AscReportRequest {
  return {
    id,
    accessType: attributes?.accessType ?? 'ONGOING',
    stoppedDueToInactivity: attributes?.stoppedDueToInactivity ?? false,
  };
}
