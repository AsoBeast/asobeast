import * as appStore from '@perttu/app-store-scraper';
import { egressFetch } from './egress/egress';
import { appStoreLib } from './app-store.lib';

jest.mock('./egress/egress', () => ({ egressFetch: jest.fn() }));
jest.mock('@perttu/app-store-scraper', () => ({
  app: jest.fn(),
  search: jest.fn(),
  similar: jest.fn(),
}));

const fetchMock = jest.mocked(egressFetch);

function answer(status: number, body: string): void {
  fetchMock.mockResolvedValueOnce(new Response(body, { status }));
}

const EMPTY_FEED = JSON.stringify({ feed: { author: {} } });

describe('appStoreLib.reviews', () => {
  beforeEach(() => fetchMock.mockReset());

  it('asks the origin past the edge cache with a fresh nonce each time', async () => {
    answer(200, EMPTY_FEED);
    answer(200, EMPTY_FEED);

    await appStoreLib.reviews({ id: 288429040, country: 'us', page: 1 });
    await appStoreLib.reviews({ id: 288429040, country: 'us', page: 1 });

    const [first, second] = fetchMock.mock.calls.map(([url]) => url as string);
    expect(first).toMatch(
      /^https:\/\/itunes\.apple\.com\/us\/rss\/customerreviews\/page=1\/id=288429040\/sortby=mostrecent\/json\?nonce=[0-9a-f-]{36}$/,
    );
    expect(second).not.toBe(first);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      headers: { 'User-Agent': 'iTunes/12.11 (Macintosh; OS X 10.15.7)' },
    });
    expect(fetchMock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('refuses a refused request', async () => {
    answer(503, 'unavailable');

    await expect(
      appStoreLib.reviews({ id: 1, country: 'us', page: 1 }),
    ).rejects.toThrow('Request failed with status 503');
  });

  it('refuses an answer that is not json', async () => {
    answer(200, '<html></html>');

    await expect(
      appStoreLib.reviews({ id: 1, country: 'us', page: 1 }),
    ).rejects.toThrow(SyntaxError);
  });
});

describe('appStoreLib edge cache', () => {
  const SEARCH_URL =
    'https://itunes.apple.com/search?term=explorer&country=us&media=software&entity=software&limit=200';

  beforeEach(() => {
    fetchMock.mockReset();
    jest.mocked(appStore.search).mockReset().mockResolvedValue([]);
  });

  async function requestedThroughScraper(url: string): Promise<string> {
    await appStoreLib.search({ term: 'explorer', country: 'us', num: 200 });
    const [options] = jest.mocked(appStore.search).mock.lastCall ?? [];
    await options?.requestOptions?.fetch?.(url, { method: 'GET' });
    const [requested, init] = fetchMock.mock.lastCall ?? [];
    expect(init).toEqual({ method: 'GET' });
    return new URL(requested as URL | string).href;
  }

  it('asks the itunes origin past the edge cache with a fresh nonce each time', async () => {
    const first = new URL(await requestedThroughScraper(SEARCH_URL));
    const second = new URL(await requestedThroughScraper(SEARCH_URL));

    expect(first.searchParams.get('nonce')).toMatch(/^[0-9a-f-]{36}$/);
    expect(second.searchParams.get('nonce')).not.toBe(
      first.searchParams.get('nonce'),
    );
    first.searchParams.delete('nonce');
    expect(first.href).toBe(SEARCH_URL);
  });

  it('leaves the product page and the search hints as they are', async () => {
    const page = 'https://apps.apple.com/us/app/id1475326567';
    const hints =
      'https://search.itunes.apple.com/WebObjects/MZSearchHints.woa/wa/hints?clientApplication=Software&term=explorer';

    expect(await requestedThroughScraper(page)).toBe(page);
    expect(await requestedThroughScraper(hints)).toBe(hints);
  });
});

describe('appStoreLib.page', () => {
  beforeEach(() => fetchMock.mockReset());

  it('asks for the default localization without a language', async () => {
    answer(200, '<h1>App</h1>');

    await appStoreLib.page({ id: 1, country: 'pl' });

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://apps.apple.com/pl/app/id1',
    );
  });

  it('asks for a localization with the page language', async () => {
    answer(200, '<h1>App</h1>');
    answer(200, '<h1>App</h1>');

    await appStoreLib.page({ id: 1, country: 'pl', language: 'pl' });
    await appStoreLib.page({ id: 1, country: 'sg', language: 'zh-Hans' });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://apps.apple.com/pl/app/id1?l=pl',
      'https://apps.apple.com/sg/app/id1?l=zh-Hans',
    ]);
  });
});

const PRODUCT_PAGE = 'https://apps.apple.com/us/app/id570060128';

const SIMILAR_APP = { id: 7, title: 'Similar' } as Awaited<
  ReturnType<typeof appStore.similar>
>[number];

function scraperReadingTheProductPage(
  found: Awaited<ReturnType<typeof appStore.similar>> = [],
): void {
  jest
    .mocked(appStore.similar)
    .mockImplementation(async ({ requestOptions }) => {
      try {
        const response = await requestOptions?.fetch?.(PRODUCT_PAGE);
        if (!response?.ok) return [];
      } catch {
        return [];
      }
      return found;
    });
}

describe('appStoreLib.similar', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    jest.mocked(appStore.similar).mockReset();
  });

  it('reports a product page the store refused instead of an empty list', async () => {
    scraperReadingTheProductPage();
    answer(403, 'blocked');

    await expect(
      appStoreLib.similar({ id: 570060128, country: 'us' }),
    ).rejects.toThrow('Request failed with status 403');
  });

  it('reports a product page the store did not answer', async () => {
    scraperReadingTheProductPage();
    fetchMock.mockRejectedValueOnce(new Error('fetch failed'));

    await expect(
      appStoreLib.similar({ id: 570060128, country: 'us' }),
    ).rejects.toThrow('fetch failed');
  });

  it('still answers an empty list for a page that lists no similar apps', async () => {
    scraperReadingTheProductPage();
    answer(200, '<h1>App</h1>');

    await expect(
      appStoreLib.similar({ id: 570060128, country: 'us' }),
    ).resolves.toEqual([]);
  });

  it('answers the similar apps of a page it read', async () => {
    scraperReadingTheProductPage([SIMILAR_APP]);
    answer(200, '<h1>App</h1>');

    await expect(
      appStoreLib.similar({ id: 570060128, country: 'us' }),
    ).resolves.toEqual([SIMILAR_APP]);
  });

  it('judges each call by its own requests', async () => {
    scraperReadingTheProductPage();
    answer(429, 'too many requests');
    answer(200, '<h1>App</h1>');

    await expect(
      appStoreLib.similar({ id: 570060128, country: 'us' }),
    ).rejects.toThrow('Request failed with status 429');
    await expect(
      appStoreLib.similar({ id: 570060128, country: 'us' }),
    ).resolves.toEqual([]);
  });
});

describe('appStoreLib deadline', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    jest.mocked(appStore.app).mockReset();
  });

  it('ends the lookup at the on demand deadline', async () => {
    const deadline = new AbortController();

    await appStoreLib.app({
      id: 1475326567,
      country: 'us',
      ratings: true,
      signal: deadline.signal,
    });
    deadline.abort();

    const [options] = jest.mocked(appStore.app).mock.calls[0];
    expect(options).toMatchObject({ id: 1475326567, country: 'us' });
    expect(options.requestOptions?.signal?.aborted).toBe(true);
  });

  it('ends the product page and the reviews feed at the on demand deadline', async () => {
    const deadline = new AbortController();
    answer(200, '<h1>App</h1>');
    answer(200, EMPTY_FEED);

    await appStoreLib.page({ id: 1, country: 'us', signal: deadline.signal });
    await appStoreLib.reviews({
      id: 1,
      country: 'us',
      page: 1,
      signal: deadline.signal,
    });
    deadline.abort();

    expect(
      fetchMock.mock.calls.map(([, init]) => init?.signal?.aborted),
    ).toEqual([true, true]);
  });
});

describe('appStoreLib attempt timeout', () => {
  const ATTEMPT_TIMEOUT_MS = 15_000;

  beforeEach(() => {
    fetchMock.mockReset();
    jest.mocked(appStore.app).mockReset();
  });

  afterEach(() => jest.restoreAllMocks());

  it('gives up on a product page that stops answering', async () => {
    const stalled = new AbortController();
    const timeout = jest
      .spyOn(AbortSignal, 'timeout')
      .mockReturnValue(stalled.signal);
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new Error('The operation timed out.')),
          );
        }),
    );

    const page = appStoreLib.page({ id: 922103212, country: 'us' });
    stalled.abort();

    await expect(page).rejects.toThrow('The operation timed out.');
    expect(timeout).toHaveBeenCalledWith(ATTEMPT_TIMEOUT_MS);
  });

  it('gives up on a lookup that stops answering', async () => {
    const stalled = new AbortController();
    jest.spyOn(AbortSignal, 'timeout').mockReturnValue(stalled.signal);

    await appStoreLib.app({ id: 922103212, country: 'us', ratings: true });
    stalled.abort();

    const [options] = jest.mocked(appStore.app).mock.calls[0];
    expect(options.requestOptions?.signal?.aborted).toBe(true);
  });

  it('never trusts a lookup the scraper finished after its requests were cut short', async () => {
    const stalled = new AbortController();
    jest.spyOn(AbortSignal, 'timeout').mockReturnValue(stalled.signal);
    jest.mocked(appStore.app).mockImplementation(() => {
      stalled.abort();
      return Promise.resolve({
        id: 922103212,
        title: "McDonald's",
        screenshots: [],
      } as unknown as Awaited<ReturnType<typeof appStore.app>>);
    });

    await expect(
      appStoreLib.app({ id: 922103212, country: 'us', ratings: true }),
    ).rejects.toThrow('This operation was aborted');
  });

  it('never trusts similar apps the scraper finished after the deadline passed', async () => {
    const deadline = new AbortController();
    jest.mocked(appStore.similar).mockImplementation(() => {
      deadline.abort();
      return Promise.resolve([]);
    });

    await expect(
      appStoreLib.similar({
        id: 922103212,
        country: 'us',
        signal: deadline.signal,
      }),
    ).rejects.toThrow('This operation was aborted');
  });
});
