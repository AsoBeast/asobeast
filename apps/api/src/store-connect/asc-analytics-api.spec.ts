import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ASC_RETRY_PAUSE_MS,
  AscAnalyticsApi,
  type AscSegment,
} from './asc-analytics-api';
import {
  AscAgreementError,
  AscError,
  AscForbiddenError,
  AscRateLimitedError,
  AscRejectedKeyError,
  AscSegmentSizeError,
} from './asc-errors';
import { AscTokenCache } from './asc-token';
import { ResponseTooLargeError } from './bounded-body';
import type { AscRequest, AscResponse, AscTransport } from './asc-transport';

const fixture = (name: string): unknown =>
  JSON.parse(
    readFileSync(join(__dirname, 'fixtures', 'asc', `${name}.json`), 'utf8'),
  ) as unknown;

const apps = fixture('apps');
const instancesPage1 = fixture('instances-page-1');
const instancesPage2 = fixture('instances-page-2');
const reportRequest = fixture('report-request');
const reportRequests = fixture('report-requests');
const reports = fixture('reports');
const segments = fixture('segments');

const PEM = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  .privateKey.export({ type: 'pkcs8', format: 'pem' })
  .toString();

const ok = (body: unknown, status = 200): AscResponse => ({
  status,
  body,
  retryAfter: null,
});

const failure = (status: number, code: string): AscResponse => ({
  status,
  body: {
    errors: [{ status: String(status), code, detail: `${code} detail` }],
  },
  retryAfter: null,
});

function recorded(...responses: AscResponse[]) {
  const requests: AscRequest[] = [];
  const queue = [...responses];
  const transport: AscTransport = (request) => {
    requests.push(request);
    const next = queue.shift();
    return next
      ? Promise.resolve(next)
      : Promise.reject(new Error('no response queued'));
  };
  const pause = jest.fn(() => Promise.resolve());
  const api = new AscAnalyticsApi(
    transport,
    new AscTokenCache({
      issuerId: 'issuer',
      keyId: 'KEY1234567',
      privateKey: PEM,
    }),
    pause,
  );
  return { api, requests, pause };
}

describe('AscAnalyticsApi.appsById', () => {
  it('lists apps by store id in pages of two hundred', async () => {
    const { api, requests } = recorded(ok(apps));

    await expect(api.appsById(['1476097583', '1232780281'])).resolves.toEqual([
      { id: '1476097583', name: 'Focus Timer' },
      { id: '1232780281', name: 'Habit Loop' },
    ]);
    expect(requests[0]).toMatchObject({
      method: 'GET',
      path: '/v1/apps?filter[id]=1476097583,1232780281&fields[apps]=name,bundleId&limit=200',
    });
    expect(requests[0].token).toMatch(/^eyJ/);
  });

  it('sends one request per two hundred ids', async () => {
    const { api, requests } = recorded(ok({ data: [] }), ok({ data: [] }));
    const ids = Array.from({ length: 250 }, (_, index) => String(index + 1));

    await api.appsById(ids);

    expect(requests).toHaveLength(2);
    expect(requests[1].path).toContain('filter[id]=201,');
  });

  it('asks nothing for no ids', async () => {
    const { api, requests } = recorded();

    await expect(api.appsById([])).resolves.toEqual([]);
    expect(requests).toHaveLength(0);
  });
});

describe('AscAnalyticsApi.verify', () => {
  it('reads one app to prove the key works', async () => {
    const { api, requests } = recorded(ok(apps));

    await api.verify();

    expect(requests[0].path).toBe('/v1/apps?fields[apps]=name&limit=1');
  });
});

describe('AscAnalyticsApi report requests', () => {
  it('lists the report requests of an app', async () => {
    const { api, requests } = recorded(ok(reportRequests));

    await expect(api.reportRequests('1476097583')).resolves.toEqual([
      {
        id: 'f3a1c2d4-0001',
        accessType: 'ONGOING',
        stoppedDueToInactivity: false,
      },
      {
        id: 'f3a1c2d4-0002',
        accessType: 'ONE_TIME_SNAPSHOT',
        stoppedDueToInactivity: false,
      },
    ]);
    expect(requests[0].path).toBe(
      '/v1/apps/1476097583/analyticsReportRequests?limit=200',
    );
  });

  it('creates an ongoing request with the documented body', async () => {
    const { api, requests } = recorded(ok(reportRequest, 201));

    await expect(
      api.createReportRequest('1476097583', 'ONGOING'),
    ).resolves.toEqual({
      id: 'f3a1c2d4-0001',
      accessType: 'ONGOING',
      stoppedDueToInactivity: false,
    });
    expect(requests[0]).toMatchObject({
      method: 'POST',
      path: '/v1/analyticsReportRequests',
      body: {
        data: {
          type: 'analyticsReportRequests',
          attributes: { accessType: 'ONGOING' },
          relationships: {
            app: { data: { type: 'apps', id: '1476097583' } },
          },
        },
      },
    });
  });

  it('answers forbidden when the key may not create requests', async () => {
    const { api } = recorded(failure(403, 'FORBIDDEN_ERROR'));

    await expect(
      api.createReportRequest('1', 'ONE_TIME_SNAPSHOT'),
    ).rejects.toBeInstanceOf(AscForbiddenError);
  });
});

describe('AscAnalyticsApi.discoveryReport', () => {
  it('finds the standard discovery report by category and name', async () => {
    const { api, requests } = recorded(ok(reports));

    await expect(
      api.discoveryReport('f3a1c2d4-0001', 'standard'),
    ).resolves.toEqual({
      id: 'r-engagement-standard',
      name: 'App Store Discovery and Engagement Standard',
      category: 'APP_STORE_ENGAGEMENT',
    });
    expect(requests[0].path).toBe(
      '/v1/analyticsReportRequests/f3a1c2d4-0001/reports?filter[category]=APP_STORE_ENGAGEMENT&limit=200',
    );
  });

  it('finds the detailed one when asked', async () => {
    const { api } = recorded(ok(reports));

    await expect(
      api.discoveryReport('f3a1c2d4-0001', 'detailed'),
    ).resolves.toMatchObject({ id: 'r-engagement-detailed' });
  });

  it('answers null while no discovery report exists yet', async () => {
    const { api } = recorded(ok({ data: [] }));

    await expect(api.discoveryReport('x', 'standard')).resolves.toBeNull();
  });
});

describe('AscAnalyticsApi.dailyInstances', () => {
  it('lists daily instances after a processing date across pages', async () => {
    const { api, requests } = recorded(ok(instancesPage1), ok(instancesPage2));

    await expect(
      api.dailyInstances('r-engagement-standard', '2026-09-09'),
    ).resolves.toEqual([
      { id: 'i-0910', granularity: 'DAILY', processingDate: '2026-09-10' },
      { id: 'i-0911', granularity: 'DAILY', processingDate: '2026-09-11' },
      { id: 'i-0912', granularity: 'DAILY', processingDate: '2026-09-12' },
    ]);
    expect(requests[0].path).toBe(
      '/v1/analyticsReports/r-engagement-standard/instances?filter[granularity]=DAILY&limit=200',
    );
  });

  it('paginates with the cursor Apple returns', async () => {
    const { api, requests } = recorded(ok(instancesPage1), ok(instancesPage2));

    await api.dailyInstances('r-engagement-standard', null);

    expect(requests[1].path).toBe(
      '/v1/analyticsReports/r-engagement-standard/instances?filter%5Bgranularity%5D=DAILY&cursor=Mg.AJ8&limit=200',
    );
  });

  it('refuses a next link on another host', async () => {
    const { api } = recorded(
      ok({ data: [], links: { next: 'https://elsewhere.test/v1/x' } }),
    );

    await expect(api.dailyInstances('r', null)).rejects.toBeInstanceOf(
      AscError,
    );
  });
});

describe('AscAnalyticsApi segments', () => {
  const segment: AscSegment = {
    id: 's-1',
    checksum: '0d8ec53a5d9d4b5c8e6f1c2a7b3e9f10',
    sizeInBytes: 3,
    url: 'https://example-bucket.s3.amazonaws.com/segment-1.csv.gz?sig=1',
  };

  it('lists the segments of an instance', async () => {
    const { api, requests } = recorded(ok(segments));

    await expect(api.segments('i-0912')).resolves.toEqual([
      {
        id: 's-1',
        checksum: '0d8ec53a5d9d4b5c8e6f1c2a7b3e9f10',
        sizeInBytes: 156,
        url: 'https://example-bucket.s3.amazonaws.com/segment-1.csv.gz?X-Amz-Signature=abc',
      },
    ]);
    expect(requests[0].path).toBe(
      '/v1/analyticsReportInstances/i-0912/segments?limit=200',
    );
  });

  it('downloads a segment as bytes without the bearer token', async () => {
    const { api, requests } = recorded({
      status: 200,
      body: null,
      bytes: Buffer.from('abc'),
      retryAfter: null,
    });

    await expect(api.download(segment)).resolves.toEqual(Buffer.from('abc'));
    expect(requests[0]).toEqual({
      method: 'GET',
      path: '',
      absoluteUrl: segment.url,
      maxBytes: segment.sizeInBytes,
    });
  });

  it('refuses a segment whose size differs', async () => {
    const { api } = recorded({
      status: 200,
      body: null,
      bytes: Buffer.from('abcd'),
      retryAfter: null,
    });

    await expect(api.download(segment)).rejects.toBeInstanceOf(
      AscSegmentSizeError,
    );
  });

  it('refuses a segment link to an address literal or a private host', async () => {
    const { api, requests } = recorded();

    for (const url of [
      'https://127.0.0.1/segment.csv.gz',
      'https://[::1]/segment.csv.gz',
      'https://169.254.169.254/latest/meta-data',
      'https://localhost/segment.csv.gz',
      'https://reports.internal/segment.csv.gz',
    ]) {
      await expect(api.download({ ...segment, url })).rejects.toBeInstanceOf(
        AscError,
      );
    }
    expect(requests).toHaveLength(0);
  });

  it('answers a size error when the body outgrows the listed size', async () => {
    const api = new AscAnalyticsApi(
      () => Promise.reject(new ResponseTooLargeError(segment.sizeInBytes)),
      new AscTokenCache({
        issuerId: 'issuer',
        keyId: 'KEY1234567',
        privateKey: PEM,
      }),
    );

    await expect(api.download(segment)).rejects.toBeInstanceOf(
      AscSegmentSizeError,
    );
  });

  it('refuses a segment url that is not https', async () => {
    const { api, requests } = recorded();

    await expect(
      api.download({ ...segment, url: 'http://example.test/x' }),
    ).rejects.toBeInstanceOf(AscError);
    expect(requests).toHaveLength(0);
  });
});

describe('AscAnalyticsApi failures', () => {
  it('retries a 500 once after the pause and then throws', async () => {
    const { api, requests, pause } = recorded(
      failure(500, 'UNEXPECTED_ERROR'),
      failure(500, 'UNEXPECTED_ERROR'),
    );

    await expect(api.appsById(['111'])).rejects.toMatchObject({
      status: 500,
    });
    expect(requests).toHaveLength(2);
    expect(pause).toHaveBeenCalledWith(ASC_RETRY_PAUSE_MS);
    expect(ASC_RETRY_PAUSE_MS).toBe(2_000);
  });

  it('answers after a 500 that recovers', async () => {
    const { api } = recorded(failure(503, 'UNAVAILABLE'), ok(apps));

    await expect(api.appsById(['111'])).resolves.toHaveLength(2);
  });

  it('checks a key with one attempt so a connect answers within the proxy deadline', async () => {
    const { api, requests, pause } = recorded(
      failure(503, 'UNAVAILABLE'),
      ok(apps),
    );

    await expect(api.verify()).rejects.toMatchObject({ status: 503 });
    expect(requests).toHaveLength(1);
    expect(pause).not.toHaveBeenCalled();
  });

  it('keeps a refused segment download apart from a refused key', async () => {
    const { api } = recorded(failure(403, 'AccessDenied'));

    const download = api.download({
      id: 's',
      checksum: '',
      sizeInBytes: 3,
      url: 'https://reports.example.test/s.csv.gz',
    });

    await expect(download).rejects.toBeInstanceOf(AscError);
    await expect(download).rejects.not.toBeInstanceOf(AscRejectedKeyError);
  });

  it('names a missing agreement instead of a refused key', async () => {
    const { api } = recorded(
      failure(403, 'FORBIDDEN.REQUIRED_AGREEMENTS_MISSING_OR_EXPIRED'),
    );

    await expect(api.verify()).rejects.toBeInstanceOf(AscAgreementError);
  });

  it('throws a rate limit error on 429 without retrying', async () => {
    const { api, requests } = recorded(failure(429, 'RATE_LIMIT_EXCEEDED'));

    await expect(api.verify()).rejects.toBeInstanceOf(AscRateLimitedError);
    expect(requests).toHaveLength(1);
  });

  it.each([401, 403])(
    'throws a rejected key error on %i from a read',
    async (status) => {
      const { api } = recorded(failure(status, 'NOT_AUTHORIZED'));

      await expect(api.verify()).rejects.toBeInstanceOf(AscRejectedKeyError);
    },
  );

  it('keeps a 404 as a plain error with its status and code', async () => {
    const { api } = recorded(failure(404, 'NOT_FOUND'));

    const error: unknown = await api
      .reportRequests('9')
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AscError);
    expect(error).toMatchObject({ status: 404, code: 'NOT_FOUND' });
    expect(error).not.toBeInstanceOf(AscRejectedKeyError);
  });
});
