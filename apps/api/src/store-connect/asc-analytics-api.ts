import { AscError, AscSegmentSizeError } from './asc-errors';
import {
  createdResource,
  type AscRequester,
  type Resource,
} from './asc-requester';
import { isPublicHttps, ResponseTooLargeError } from './bounded-body';
import type { AscResponse } from './asc-transport';

export const ASC_PAGE_SIZE = 200;
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

const chunks = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );

export class AscAnalyticsApi {
  constructor(private readonly requester: AscRequester) {}

  async verify(): Promise<void> {
    await this.requester.send(
      { method: 'GET', path: '/v1/apps?fields[apps]=name&limit=1' },
      false,
    );
  }

  async appsById(ids: string[]): Promise<AscApp[]> {
    const pages = [];
    for (const batch of chunks(ids, ASC_PAGE_SIZE)) {
      pages.push(
        ...(await this.requester.page<{ name?: string }>(
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
    const requests = await this.requester.page<Omit<AscReportRequest, 'id'>>(
      `/v1/apps/${encodeURIComponent(appId)}/analyticsReportRequests?limit=${ASC_PAGE_SIZE}`,
    );
    return requests.map(toReportRequest);
  }

  async createReportRequest(
    appId: string,
    accessType: AscAccessType,
  ): Promise<AscReportRequest> {
    const response = await this.requester.send({
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
    return toReportRequest(
      createdResource<Omit<AscReportRequest, 'id'>>(response),
    );
  }

  async discoveryReport(
    requestId: string,
    variant: DiscoveryVariant,
  ): Promise<AscReport | null> {
    const reports = await this.requester.page<{
      name?: string;
      category?: string;
    }>(
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
    const instances = await this.requester.page<Omit<AscInstance, 'id'>>(
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
    const segments = await this.requester.page<Omit<AscSegment, 'id'>>(
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
    if (!isPublicHttps(segment.url)) {
      throw new AscError(
        'A report segment link is not a public https address',
        502,
        null,
      );
    }
    let response: AscResponse;
    try {
      response = await this.requester.send({
        method: 'GET',
        path: '',
        absoluteUrl: segment.url,
        maxBytes: segment.sizeInBytes,
      });
    } catch (error) {
      if (!(error instanceof ResponseTooLargeError)) throw error;
      throw new AscSegmentSizeError(segment.sizeInBytes, null);
    }
    const bytes = response.bytes ?? Buffer.alloc(0);
    if (bytes.length !== segment.sizeInBytes) {
      throw new AscSegmentSizeError(segment.sizeInBytes, bytes.length);
    }
    return bytes;
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
