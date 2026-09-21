import {
  AppleAdsPopularityClient,
  ApplePopularityError,
  PAGE_SIZE,
  PopularityApi,
  retryRateLimitedOnce,
} from './apple-popularity.client';

const row = (overrides: Record<string, unknown> = {}) => ({
  week: '2026-09-13',
  countryOrRegion: 'US',
  genre: 'GAMES',
  searchTerm: 'Geo Quiz',
  rankInGenre: 4,
  searchPopularityInGenre: 80,
  searchPopularity1to100: 71,
  ...overrides,
});

const page = (rows: unknown[]) => ({ data: { result: { rows } } });

const fakeApi = (pages: unknown[][] = [[row()]]) => {
  const query = jest.fn();
  pages.forEach((rows) => query.mockResolvedValueOnce(page(rows)));
  return {
    getUserAcls: jest.fn().mockResolvedValue({
      data: { result: { acls: [{ adAccount: { id: 4242 } }] } },
    }),
    searchTermPopularityQuery: query,
  };
};

const clientFor = (api: ReturnType<typeof fakeApi>, adAccountId?: string) =>
  new AppleAdsPopularityClient(
    () => Promise.resolve(api as unknown as PopularityApi),
    adAccountId,
  );

describe('AppleAdsPopularityClient', () => {
  it('asks for one sunday to saturday week of one storefront', async () => {
    const api = fakeApi();

    await clientFor(api, '777').weekOf('us', '2026-09-13');

    expect(api.searchTermPopularityQuery).toHaveBeenCalledWith(
      'adAccountId=777',
      {
        filters: [
          { field: 'countryOrRegion', operator: 'EQUALS', value: 'US' },
        ],
        timeRange: {
          start: '2026-09-13',
          end: '2026-09-19',
          granularity: 'WEEKLY_SUN_SAT',
        },
        sorting: [{ field: 'searchPopularity1to100', order: 'DESC' }],
        pagination: { offset: 0, pageSize: 5000 },
      },
    );
    expect(api.getUserAcls).not.toHaveBeenCalled();
  });

  it('maps rows onto the stored key', async () => {
    const rows = await clientFor(fakeApi(), '777').weekOf('us', '2026-09-13');

    expect(rows).toEqual([
      {
        country: 'us',
        term: 'geo quiz',
        week: '2026-09-13',
        genre: 'GAMES',
        rankInGenre: 4,
        popularity: 71,
        popularityInGenre: 80,
      },
    ]);
  });

  it('pages until a short page', async () => {
    const full = Array.from({ length: PAGE_SIZE }, (_, index) =>
      row({ searchTerm: `term ${index}` }),
    );
    const api = fakeApi([full, [row()]]);

    const rows = await clientFor(api, '777').weekOf('us', '2026-09-13');

    expect(rows).toHaveLength(PAGE_SIZE + 1);
    expect(api.searchTermPopularityQuery).toHaveBeenCalledTimes(2);
    const [, second] = api.searchTermPopularityQuery.mock.calls[1] as [
      string,
      { pagination: { offset: number } },
    ];
    expect(second.pagination.offset).toBe(PAGE_SIZE);
  });

  it('stops after ten full pages', async () => {
    const full = Array.from({ length: PAGE_SIZE }, () => row());
    const api = fakeApi(Array.from({ length: 12 }, () => full));

    await clientFor(api, '777').weekOf('us', '2026-09-13');

    expect(api.searchTermPopularityQuery).toHaveBeenCalledTimes(10);
  });

  it('resolves the ad account from the access list once', async () => {
    const api = fakeApi([[row()], [row()]]);
    const client = clientFor(api);

    await client.weekOf('us', '2026-09-13');
    await client.weekOf('gb', '2026-09-13');

    expect(api.getUserAcls).toHaveBeenCalledTimes(1);
    expect(api.searchTermPopularityQuery).toHaveBeenCalledWith(
      'adAccountId=4242',
      expect.anything(),
    );
  });

  it.each([
    ['a term', { searchTerm: undefined }],
    ['a week', { week: undefined }],
    ['a popularity', { searchPopularity1to100: undefined }],
    ['a finite popularity', { searchPopularity1to100: Number.NaN }],
  ])('skips a row without %s', async (_name, overrides) => {
    const rows = await clientFor(fakeApi([[row(overrides)]]), '777').weekOf(
      'us',
      '2026-09-13',
    );
    expect(rows).toEqual([]);
  });

  it('refuses a week that does not start on a sunday', async () => {
    await expect(
      clientFor(fakeApi(), '777').weekOf('us', '2026-09-14'),
    ).rejects.toThrow(RangeError);
  });

  it('surfaces a failed call with its status and no credential', async () => {
    const api = fakeApi();
    api.searchTermPopularityQuery.mockReset().mockRejectedValue(
      Object.assign(new Error('Request failed for SEARCHADS.client key-1'), {
        status: 403,
      }),
    );

    const failure = clientFor(api, '777').weekOf('us', '2026-09-13');

    await expect(failure).rejects.toBeInstanceOf(ApplePopularityError);
    await expect(failure).rejects.toMatchObject({ status: 403 });
    await expect(failure).rejects.not.toThrow(/SEARCHADS|key-1/);
  });

  it('fails clearly without an ad account', async () => {
    const api = fakeApi();
    api.getUserAcls.mockResolvedValue({ data: { result: { acls: [] } } });

    await expect(
      clientFor(api).weekOf('us', '2026-09-13'),
    ).rejects.toBeInstanceOf(ApplePopularityError);
  });
});

describe('retryRateLimitedOnce', () => {
  const install = () => {
    let onRejected: (error: unknown) => Promise<unknown> = () =>
      Promise.resolve();
    const instance = {
      interceptors: {
        response: {
          use: (_: unknown, rejected: typeof onRejected) => {
            onRejected = rejected;
          },
        },
      },
      request: jest.fn().mockResolvedValue({ data: 'ok' }),
    };
    const sleep = jest.fn().mockResolvedValue(undefined);
    retryRateLimitedOnce(
      instance as unknown as Parameters<typeof retryRateLimitedOnce>[0],
      sleep,
    );
    return { instance, sleep, reject: (error: unknown) => onRejected(error) };
  };
  const limited = (retryAfter?: string, config: object = { url: '/q' }) => ({
    config,
    response: {
      status: 429,
      headers: retryAfter === undefined ? {} : { 'retry-after': retryAfter },
    },
  });

  it('waits for retry after and repeats the request once', async () => {
    const { instance, sleep, reject } = install();

    await expect(reject(limited('3'))).resolves.toEqual({ data: 'ok' });

    expect(sleep).toHaveBeenCalledWith(3_000);
    expect(instance.request).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a long wait', '600', 16_000],
    ['no header', undefined, 16_000],
  ])('caps %s at sixteen seconds', async (_name, header, expected) => {
    const { sleep, reject } = install();
    await reject(limited(header));
    expect(sleep).toHaveBeenCalledWith(expected);
  });

  it('gives up on a second rate limit and on other errors', async () => {
    const { instance, reject } = install();
    const retried = limited('1');
    await reject(retried);
    const [config] = instance.request.mock.calls[0] as [object];

    const second = limited('1', config);
    await expect(reject(second)).rejects.toBe(second);
    const forbidden = { config: {}, response: { status: 403, headers: {} } };
    await expect(reject(forbidden)).rejects.toBe(forbidden);
    expect(instance.request).toHaveBeenCalledTimes(1);
  });
});
