import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import * as undici from 'undici';
import { publicOnlyDispatcher } from '../../alerts/webhook-dispatcher';
import { Env } from '../../config/env';
import { PUBLISHED_STATUS_KEY } from '../../jobs/jobs.types';
import { PUBLISHED_STATUS_SCHEMA_VERSION } from './published-status';
import {
  PUBLISHED_STATUS_MAX_AGE_HOURS,
  PUBLISHED_STATUS_MAX_BYTES,
  PublishedStatusRecord,
  PublishedStatusService,
} from './published-status.service';

jest.mock('undici', () => ({
  ...jest.requireActual<typeof undici>('undici'),
  fetch: jest.fn(),
}));

jest.mock('../../alerts/webhook-dispatcher', () => ({
  publicOnlyDispatcher: jest.fn(() => ({
    close: () => Promise.resolve(),
    marker: 'public-only',
  })),
}));

const fetchMock = undici.fetch as unknown as jest.Mock;
const dispatcherMock = publicOnlyDispatcher as unknown as jest.Mock;

const URL_TEXT = 'https://status.asobeast.com/store-status.json';

const DOCUMENT = {
  schemaVersion: PUBLISHED_STATUS_SCHEMA_VERSION,
  updatedAt: '2026-08-28T09:00:00Z',
  stores: {
    APP_STORE: { state: 'ok' },
    GOOGLE_PLAY: {
      state: 'broken',
      since: '2026-08-28T02:10:00Z',
      summary: 'Google Play changed the shape of its search response.',
    },
  },
};

function bodyOf(text: string): {
  stream: ReadableStream<Uint8Array>;
  cancelled: jest.Mock;
} {
  const cancelled = jest.fn();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
    cancel: cancelled,
  });
  return { stream, cancelled };
}

function responseOf(
  text: string,
  init: { status?: number; contentLength?: string } = {},
) {
  const body = bodyOf(text);
  return {
    ok: (init.status ?? 200) < 400,
    status: init.status ?? 200,
    headers: {
      get: (name: string) =>
        name === 'content-length' ? (init.contentLength ?? null) : null,
    },
    body: body.stream,
    cancelled: body.cancelled,
  };
}

function build(url: string | undefined, stored: Record<string, string> = {}) {
  const redis = new Map(Object.entries(stored));
  const client = {
    get: jest.fn((key: string) => Promise.resolve(redis.get(key) ?? null)),
    set: jest.fn((key: string, value: string) => {
      redis.set(key, value);
      return Promise.resolve('OK');
    }),
  };
  const config = {
    get: jest.fn((key: string) =>
      key === 'STORE_STATUS_URL' ? url : '17 * * * *',
    ),
  };
  const service = new PublishedStatusService(
    config as unknown as ConfigService<Env, true>,
    {
      getBackend: () => ({ client: Promise.resolve(client) }),
    } as unknown as Queue,
  );
  return { service, client, redis };
}

function written(redis: Map<string, string>): PublishedStatusRecord {
  return JSON.parse(redis.get(PUBLISHED_STATUS_KEY)!) as PublishedStatusRecord;
}

describe('PublishedStatusService', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('stays off and opens nothing while no status url is set', async () => {
    const { service, client } = build(undefined);

    expect(service.enabled).toBe(false);
    await service.run();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(client.set).not.toHaveBeenCalled();
  });

  it('stays off when the configured url is not a public http target', async () => {
    const { service } = build('file:///etc/passwd');

    expect(service.enabled).toBe(false);
    await service.run();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('records the parsed document when the poll succeeds', async () => {
    const { service, redis } = build(URL_TEXT);
    fetchMock.mockResolvedValue(responseOf(JSON.stringify(DOCUMENT)));

    await service.run();

    expect(written(redis).stores).toEqual({
      APP_STORE: { state: 'ok', since: null, summary: null },
      GOOGLE_PLAY: {
        state: 'broken',
        since: '2026-08-28T02:10:00.000Z',
        summary: 'Google Play changed the shape of its search response.',
      },
    });
    expect(Date.parse(written(redis).fetchedAt)).not.toBeNaN();
  });

  it('polls through the same ssrf guard webhook delivery uses', async () => {
    const { service } = build(URL_TEXT);
    fetchMock.mockResolvedValue(responseOf(JSON.stringify(DOCUMENT)));

    await service.run();

    const [target, init] = fetchMock.mock.calls[0] as [
      URL,
      { dispatcher: unknown; redirect: string; method: string },
    ];
    expect(target.href).toBe(URL_TEXT);
    expect(init.method).toBe('GET');
    expect(init.redirect).toBe('manual');
    expect(init.dispatcher).toBe(dispatcherMock.mock.results.at(-1)?.value);
  });

  it('sends no body, no query string and no identifying header', async () => {
    const { service } = build(URL_TEXT);
    fetchMock.mockResolvedValue(responseOf(JSON.stringify(DOCUMENT)));

    await service.run();

    const [target, init] = fetchMock.mock.calls[0] as [
      URL,
      Record<string, unknown>,
    ];
    expect(target.search).toBe('');
    expect(init.body).toBeUndefined();
    expect(init.headers).toBeUndefined();
  });

  it.each([
    ['a 404', () => Promise.resolve(responseOf('{}', { status: 404 }))],
    ['a 500', () => Promise.resolve(responseOf('{}', { status: 500 }))],
    ['a timeout', () => Promise.reject(new Error('The operation timed out'))],
    ['a transport failure', () => Promise.reject(new Error('fetch failed'))],
    ['malformed json', () => Promise.resolve(responseOf('{"schemaVersion":'))],
    [
      'a document this version cannot read',
      () => Promise.resolve(responseOf(JSON.stringify({ schemaVersion: 9 }))),
    ],
  ])(
    'leaves the previous record untouched after %s',
    async (_label, answer) => {
      const previous: PublishedStatusRecord = {
        fetchedAt: new Date().toISOString(),
        stores: { APP_STORE: { state: 'ok', since: null, summary: null } },
      };
      const { service, redis, client } = build(URL_TEXT, {
        [PUBLISHED_STATUS_KEY]: JSON.stringify(previous),
      });
      fetchMock.mockImplementation(answer);

      await expect(service.run()).resolves.toBeUndefined();

      expect(client.set).not.toHaveBeenCalled();
      expect(written(redis)).toEqual(previous);
    },
  );

  it('refuses a body larger than the cap before parsing it', async () => {
    const { service, client } = build(URL_TEXT);
    fetchMock.mockResolvedValue(
      responseOf('x'.repeat(PUBLISHED_STATUS_MAX_BYTES + 1)),
    );

    await service.run();

    expect(client.set).not.toHaveBeenCalled();
  });

  it('refuses a declared length larger than the cap', async () => {
    const { service, client } = build(URL_TEXT);
    fetchMock.mockResolvedValue(
      responseOf(JSON.stringify(DOCUMENT), {
        contentLength: String(PUBLISHED_STATUS_MAX_BYTES + 1),
      }),
    );

    await service.run();

    expect(client.set).not.toHaveBeenCalled();
  });

  it('reads back a fresh record', async () => {
    const { service } = build(URL_TEXT, {
      [PUBLISHED_STATUS_KEY]: JSON.stringify({
        fetchedAt: new Date().toISOString(),
        stores: { APP_STORE: { state: 'broken', since: null, summary: null } },
      }),
    });

    expect(await service.published()).toEqual({
      APP_STORE: { state: 'broken', since: null, summary: null },
    });
  });

  it('treats a record past its maximum age as absent', async () => {
    const stale = new Date(
      Date.now() - (PUBLISHED_STATUS_MAX_AGE_HOURS + 1) * 3_600_000,
    ).toISOString();
    const { service } = build(URL_TEXT, {
      [PUBLISHED_STATUS_KEY]: JSON.stringify({
        fetchedAt: stale,
        stores: { APP_STORE: { state: 'broken', since: null, summary: null } },
      }),
    });

    expect(await service.published()).toEqual({});
  });

  it.each([
    ['nothing stored', undefined],
    ['unreadable json', 'not json'],
    ['a record with no fetch time', '{"stores":{}}'],
  ])('reads %s as nothing published', async (_label, stored) => {
    const { service } = build(
      URL_TEXT,
      stored === undefined ? {} : { [PUBLISHED_STATUS_KEY]: stored },
    );

    expect(await service.published()).toEqual({});
  });

  it.each([
    ['a non-200 answer', () => responseOf('{}', { status: 404 })],
    [
      'a declared length over the cap',
      () =>
        responseOf('{}', {
          contentLength: String(PUBLISHED_STATUS_MAX_BYTES + 1),
        }),
    ],
  ])(
    'releases the connection after %s rather than leaking it',
    async (_label, answer) => {
      const { service } = build(URL_TEXT);
      const response = answer();
      fetchMock.mockResolvedValue(response);

      await service.run();

      expect(response.cancelled).toHaveBeenCalledTimes(1);
    },
  );

  it('leaves a body it read to completion alone', async () => {
    const { service } = build(URL_TEXT);
    const response = responseOf(JSON.stringify(DOCUMENT));
    fetchMock.mockResolvedValue(response);

    await service.run();

    expect(response.cancelled).not.toHaveBeenCalled();
  });
});
