import { generateKeyPairSync } from 'node:crypto';
import { ResponseTooLargeError } from '../bounded-body';
import {
  GcsApi,
  GcsBucketError,
  GcsRateLimitedError,
  GcsRejectedError,
  GcsTokenRefusedError,
  GcsTooLargeError,
  MAX_LISTED_OBJECTS,
  PLAY_REPORT_MAX_BYTES,
  STORE_PERFORMANCE_PREFIX,
  storePerformanceObjects,
} from './gcs-api';
import type { GcsRequest, GcsResponse, GcsTransport } from './gcs-transport';
import { parseServiceAccount, serviceAccountGrant } from './service-account';

const KEY = parseServiceAccount(
  JSON.stringify({
    client_email: 'reports@asobeast-play.iam.gserviceaccount.com',
    private_key_id: 'kid',
    private_key: generateKeyPairSync('rsa', { modulusLength: 2048 })
      .privateKey.export({ type: 'pkcs8', format: 'pem' })
      .toString(),
  }),
);

const BUCKET = 'pubsite_prod_rev_01234567890987654321';
const SOURCE = {
  grant: serviceAccountGrant(KEY),
  bucket: BUCKET,
  account: { kind: 'key' as const, email: KEY.clientEmail },
};
const TOKEN = { status: 200, body: { access_token: 'ya29', expires_in: 3600 } };

function recorded(...responses: GcsResponse[]) {
  const requests: GcsRequest[] = [];
  const queue = [TOKEN, ...responses];
  const transport: GcsTransport = (request) => {
    requests.push(request);
    const next = queue.shift();
    return next
      ? Promise.resolve(next)
      : Promise.reject(new Error('no response queued'));
  };
  return { api: new GcsApi(transport, SOURCE), requests };
}

const item = (name: string, generation: string) => ({
  name: `${STORE_PERFORMANCE_PREFIX}${name}`,
  size: '120',
  md5Hash: 'abc==',
  generation,
  updated: '2026-10-15T10:00:00.000Z',
});

describe('GcsApi', () => {
  it('exchanges a signed assertion for a token with the jwt grant', async () => {
    const { api, requests } = recorded({ status: 200, body: { items: [] } });

    await api.listStorePerformance();

    expect(requests[0]).toMatchObject({
      method: 'POST',
      url: 'https://oauth2.googleapis.com/token',
      form: { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer' },
    });
    expect(requests[0].form?.assertion.split('.')).toHaveLength(3);
  });

  it('lists objects under the store performance prefix across page tokens', async () => {
    const { api, requests } = recorded(
      {
        status: 200,
        body: { items: [item('a.csv', '1')], nextPageToken: 'p2' },
      },
      { status: 200, body: { items: [item('b.csv', '2')] } },
    );

    const objects = await api.listStorePerformance('com.example.habits');

    expect(objects.map((object) => object.name)).toEqual([
      `${STORE_PERFORMANCE_PREFIX}a.csv`,
      `${STORE_PERFORMANCE_PREFIX}b.csv`,
    ]);
    expect(objects[0]).toEqual({
      name: `${STORE_PERFORMANCE_PREFIX}a.csv`,
      size: 120,
      md5Hash: 'abc==',
      generation: '1',
      updated: '2026-10-15T10:00:00.000Z',
    });
    const first = new URL(requests[1].url);
    expect(first.pathname).toBe(`/storage/v1/b/${BUCKET}/o`);
    expect(first.searchParams.get('prefix')).toBe(
      'stats/store_performance/store_performance_com.example.habits_',
    );
    expect(requests[1].bearer).toBe('ya29');
    expect(new URL(requests[2].url).searchParams.get('pageToken')).toBe('p2');
  });

  it('downloads an object by its encoded name', async () => {
    const { api, requests } = recorded({
      status: 200,
      body: null,
      bytes: Buffer.from('csv'),
    });

    await expect(
      api.download('stats/store_performance/x.csv'),
    ).resolves.toEqual(Buffer.from('csv'));
    expect(requests[1].url).toBe(
      `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o/stats%2Fstore_performance%2Fx.csv?alt=media`,
    );
    expect(requests[1].binary).toBe(true);
    expect(requests[1].maxBytes).toBe(PLAY_REPORT_MAX_BYTES);
  });

  it('answers a too large error for a body past the ceiling', async () => {
    const api = new GcsApi(
      (request) =>
        request.method === 'POST'
          ? Promise.resolve(TOKEN)
          : Promise.reject(new ResponseTooLargeError(PLAY_REPORT_MAX_BYTES)),
      SOURCE,
    );

    await expect(api.download('stats/x.csv')).rejects.toBeInstanceOf(
      GcsTooLargeError,
    );
  });

  it('stops listing after the object ceiling', async () => {
    const page = (token?: string) => ({
      status: 200,
      body: {
        items: Array.from({ length: 300 }, (_, index) =>
          item(`f${token ?? ''}${index}.csv`, '1'),
        ),
        nextPageToken: 'more',
      },
    });
    const { api, requests } = recorded(page('a'), page('b'), page('c'));

    const objects = await api.listStorePerformance('com.x');

    expect(objects).toHaveLength(MAX_LISTED_OBJECTS);
    expect(requests).toHaveLength(3);
  });

  it.each([
    [401, GcsRejectedError],
    [403, GcsRejectedError],
    [404, GcsBucketError],
    [429, GcsRateLimitedError],
  ])('maps a %i to its error', async (status, type) => {
    const { api } = recorded({ status, body: null });

    await expect(api.listStorePerformance('com.x')).rejects.toBeInstanceOf(
      type,
    );
  });

  it.each([400, 401, 403])(
    'maps a %i to the token request to a refused token',
    async (status) => {
      const transport: GcsTransport = () =>
        Promise.resolve({ status, body: { error: 'invalid_grant' } });

      const listing = new GcsApi(transport, SOURCE).listStorePerformance(
        'com.x',
      );

      await expect(listing).rejects.toBeInstanceOf(GcsTokenRefusedError);
      await expect(listing).rejects.toBeInstanceOf(GcsRejectedError);
      await expect(listing).rejects.toMatchObject({ code: 'invalid_grant' });
    },
  );

  it('keeps a refused bucket apart from a refused token', async () => {
    const { api } = recorded({ status: 403, body: null });

    const listing = api.listStorePerformance('com.x');

    await expect(listing).rejects.toBeInstanceOf(GcsRejectedError);
    await expect(listing).rejects.not.toBeInstanceOf(GcsTokenRefusedError);
  });

  it('sends the form of its grant to the token endpoint', async () => {
    const requests: GcsRequest[] = [];
    const transport: GcsTransport = (request) => {
      requests.push(request);
      return Promise.resolve(
        request.method === 'POST' ? TOKEN : { status: 200, body: {} },
      );
    };
    const api = new GcsApi(transport, {
      ...SOURCE,
      grant: () => ({ grant_type: 'refresh_token', refresh_token: '1//r' }),
    });

    await api.verify();

    expect(requests[0].form).toEqual({
      grant_type: 'refresh_token',
      refresh_token: '1//r',
    });
    expect(api.account).toEqual(SOURCE.account);
  });
});

describe('storePerformanceObjects', () => {
  it('answers the two monthly files of a package for a month', () => {
    const objects = [
      item('store_performance_com.example.app_202610_country.csv', '5'),
      item('store_performance_com.example.app_202610_traffic_source.csv', '6'),
      item('store_performance_com.example.app_202609_country.csv', '3'),
      item('store_performance_com.other_202610_country.csv', '9'),
    ].map((raw) => ({ ...raw, size: 1, md5Hash: null }));

    const files = storePerformanceObjects(objects, 'com.example.app', '202610');

    expect(files.country?.generation).toBe('5');
    expect(files.traffic?.generation).toBe('6');
    expect(
      storePerformanceObjects(objects, 'com.example.app', '202608'),
    ).toEqual({ country: null, traffic: null });
  });
});
