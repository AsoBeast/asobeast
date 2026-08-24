import { ProxyProtocol, ProxyTier } from '@prisma/client';
import { ProxyPoolConfig } from './proxy-pool.config';
import { ProxyProviderError, WebshareClient } from './webshare.client';

interface WebshareRow {
  id: string;
  proxy_address: string;
  port: number;
  valid: boolean;
  country_code?: string | null;
}

const page = (results: WebshareRow[], next: string | null = null) => ({
  ok: true,
  json: () => Promise.resolve({ results, next }),
});

const row = (over: Partial<WebshareRow> = {}): WebshareRow => ({
  id: 'p1',
  proxy_address: '10.0.0.1',
  port: 8080,
  valid: true,
  country_code: 'US',
  ...over,
});

describe('WebshareClient', () => {
  const realFetch = globalThis.fetch;
  const fetchMock = jest.fn();
  const config = {
    apiUrl: 'https://proxy.example/api/v2',
    apiKey: 'key-123',
  } as unknown as ProxyPoolConfig;

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('bounds the listing request so a hung provider cannot stall the boot', async () => {
    fetchMock.mockResolvedValue(page([row()]));

    await new WebshareClient(config).list();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('refuses a listing the provider did not shape as a page', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    await expect(new WebshareClient(config).list()).rejects.toThrow(
      ProxyProviderError,
    );
  });

  it('refuses a listing whose results are not a list', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: 'nope', next: null }),
    });

    await expect(new WebshareClient(config).list()).rejects.toThrow(
      ProxyProviderError,
    );
  });

  it('refuses a body that is not json at all', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new Error('Unexpected token < in JSON')),
    });

    await expect(new WebshareClient(config).list()).rejects.toThrow(
      ProxyProviderError,
    );
  });

  it('names the provider and the timeout when the request is aborted', async () => {
    fetchMock.mockRejectedValue(
      Object.assign(new Error('The operation was aborted'), {
        name: 'TimeoutError',
      }),
    );

    await expect(new WebshareClient(config).list()).rejects.toThrow(
      /webshare proxy listing failed/,
    );
  });

  it.each([
    ['a null entry', null],
    ['a string entry', 'proxy'],
    ['a missing identifier', { ...row(), id: undefined }],
    ['a non textual host', { ...row(), proxy_address: 42 }],
    ['an empty host', { ...row(), proxy_address: '   ' }],
    ['a textual port', { ...row(), port: '8080' }],
    ['a fractional port', { ...row(), port: 80.5 }],
    ['a port below the range', { ...row(), port: 0 }],
    ['a port above the range', { ...row(), port: 65_536 }],
    ['a missing validity flag', { ...row(), valid: undefined }],
    ['a non boolean validity flag', { ...row(), valid: 'yes' }],
    ['a non textual country', { ...row(), country_code: 7 }],
  ])('refuses a page carrying %s', async (_label, entry) => {
    fetchMock.mockResolvedValue(page([entry as unknown as WebshareRow]));

    await expect(new WebshareClient(config).list()).rejects.toThrow(
      ProxyProviderError,
    );
  });

  it('names the entry that broke the page', async () => {
    fetchMock.mockResolvedValue(page([row(), null as unknown as WebshareRow]));

    await expect(new WebshareClient(config).list()).rejects.toThrow(
      /entry 1 is not a proxy the pool can trust/,
    );
  });

  it('refuses a malformed page before any of it reaches the pool', async () => {
    fetchMock.mockResolvedValue(page([row(), row({ port: -1 })]));

    await expect(new WebshareClient(config).list()).rejects.toThrow(
      ProxyProviderError,
    );
  });

  it('accepts a numeric identifier the provider may send', async () => {
    fetchMock.mockResolvedValue(
      page([{ ...row(), id: 7 } as unknown as WebshareRow]),
    );

    const [proxy] = await new WebshareClient(config).list();

    expect(proxy.externalId).toBe('7');
  });

  it('accepts a row that omits the country altogether', async () => {
    fetchMock.mockResolvedValue(
      page([{ id: 'p2', proxy_address: '10.0.0.2', port: 8080, valid: true }]),
    );

    const [proxy] = await new WebshareClient(config).list();

    expect(proxy.country).toBeUndefined();
  });

  it('maps a listed proxy onto a pool endpoint', async () => {
    fetchMock.mockResolvedValue(page([row()]));

    await expect(new WebshareClient(config).list()).resolves.toEqual([
      {
        externalId: 'p1',
        host: '10.0.0.1',
        port: 8080,
        protocol: ProxyProtocol.HTTP,
        tier: ProxyTier.DATACENTER,
        country: 'us',
      },
    ]);
  });

  it('authenticates with the configured api key', async () => {
    fetchMock.mockResolvedValue(page([]));

    await new WebshareClient(config).list();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://proxy.example/api/v2/proxy/list/?mode=direct&page=1&page_size=100',
      expect.objectContaining({
        headers: { Authorization: 'Token key-123' },
      }),
    );
  });

  it('follows pagination until the last page', async () => {
    fetchMock
      .mockResolvedValueOnce(page([row({ id: 'p1' })], 'next-page'))
      .mockResolvedValueOnce(
        page([row({ id: 'p2', proxy_address: '10.0.0.2' })]),
      );

    const proxies = await new WebshareClient(config).list();

    expect(proxies.map((proxy) => proxy.externalId)).toEqual(['p1', 'p2']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('skips a retired proxy without judging the rest of its row', async () => {
    fetchMock.mockResolvedValue(
      page([row(), { id: 'p9', proxy_address: '', port: 0, valid: false }]),
    );

    const proxies = await new WebshareClient(config).list();

    expect(proxies.map((proxy) => proxy.externalId)).toEqual(['p1']);
  });

  it('skips a proxy the provider marks invalid', async () => {
    fetchMock.mockResolvedValue(page([row({ valid: false })]));

    await expect(new WebshareClient(config).list()).resolves.toEqual([]);
  });

  it('omits an unknown country rather than guessing one', async () => {
    fetchMock.mockResolvedValue(page([row({ country_code: null })]));

    const [proxy] = await new WebshareClient(config).list();

    expect(proxy.country).toBeUndefined();
  });

  it('fails loudly on a rejected listing', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 });

    await expect(new WebshareClient(config).list()).rejects.toThrow(
      ProxyProviderError,
    );
  });
});
