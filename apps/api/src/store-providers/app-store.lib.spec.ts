import { egressFetch } from './egress/egress';
import { appStoreLib } from './app-store.lib';

jest.mock('./egress/egress', () => ({ egressFetch: jest.fn() }));

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
    expect(fetchMock.mock.calls[0][1]).toEqual({
      headers: { 'User-Agent': 'iTunes/12.11 (Macintosh; OS X 10.15.7)' },
    });
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
