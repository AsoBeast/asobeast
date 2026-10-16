import { generateKeyPairSync } from 'node:crypto';
import {
  GcsApi,
  GcsBucketError,
  GcsRateLimitedError,
  GcsRejectedError,
  STORE_PERFORMANCE_PREFIX,
  storePerformanceObjects,
} from './gcs-api';
import type { GcsRequest, GcsResponse, GcsTransport } from './gcs-transport';
import { parseServiceAccount } from './service-account';

const ACCOUNT = parseServiceAccount(
  JSON.stringify({
    client_email: 'reports@asobeast-play.iam.gserviceaccount.com',
    private_key_id: 'kid',
    private_key: generateKeyPairSync('rsa', { modulusLength: 2048 })
      .privateKey.export({ type: 'pkcs8', format: 'pem' })
      .toString(),
  }),
);

const BUCKET = 'pubsite_prod_rev_01234567890987654321';
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
  return { api: new GcsApi(transport, ACCOUNT, BUCKET), requests };
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

    const objects = await api.listStorePerformance();

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
    expect(first.searchParams.get('prefix')).toBe('stats/store_performance/');
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
  });

  it.each([
    [401, GcsRejectedError],
    [403, GcsRejectedError],
    [404, GcsBucketError],
    [429, GcsRateLimitedError],
  ])('maps a %i to its error', async (status, type) => {
    const { api } = recorded({ status, body: null });

    await expect(api.listStorePerformance()).rejects.toBeInstanceOf(type);
  });

  it('maps a refused token request to a rejected account', async () => {
    const transport: GcsTransport = () =>
      Promise.resolve({ status: 400, body: { error: 'invalid_grant' } });

    await expect(
      new GcsApi(transport, ACCOUNT, BUCKET).listStorePerformance(),
    ).rejects.toBeInstanceOf(GcsRejectedError);
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
