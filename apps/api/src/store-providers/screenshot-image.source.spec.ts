import { ScreenshotFetchError } from './errors';
import {
  MAX_SCREENSHOT_BYTES,
  ScreenshotImageSource,
} from './screenshot-image.source';

const URL_IN =
  'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource221/v4/50/e2/8b/50e28b44/1_iOS_5.5.jpg/392x696bb.jpg';
const URL_OUT =
  'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource221/v4/50/e2/8b/50e28b44/1_iOS_5.5.jpg/1080x0w.jpg';

const image = (body: Uint8Array, headers: Record<string, string> = {}) =>
  new Response(body, {
    status: 200,
    headers: { 'content-type': 'image/jpeg', ...headers },
  });

const failure = async (source: ScreenshotImageSource) => {
  try {
    await source.read(URL_IN);
  } catch (error) {
    return error as ScreenshotFetchError;
  }
  throw new Error('expected the read to fail');
};

describe('ScreenshotImageSource', () => {
  const fetchMock = jest.spyOn(globalThis, 'fetch');
  const source = new ScreenshotImageSource();

  beforeEach(() => fetchMock.mockReset());
  afterAll(() => fetchMock.mockRestore());

  it('downloads the ocr rendition and returns its bytes', async () => {
    fetchMock.mockResolvedValue(image(new Uint8Array([1, 2, 3])));

    const bytes = await source.read(URL_IN);

    expect(bytes).toEqual(Buffer.from([1, 2, 3]));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [address, init] = fetchMock.mock.calls[0];
    expect(address).toBe(URL_OUT);
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('refuses an address outside the apple image cdn without a request', async () => {
    const error = await source
      .read('https://images.example.com/a.jpg/392x696bb.jpg')
      .catch((caught: ScreenshotFetchError) => caught);

    expect(error).toBeInstanceOf(ScreenshotFetchError);
    expect((error as ScreenshotFetchError).retryable).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([403, 404, 410])('gives up for good on a %i', async (status) => {
    fetchMock.mockResolvedValue(new Response('', { status }));

    expect((await failure(source)).retryable).toBe(false);
  });

  it.each([408, 429, 500, 503])('lets a %i be retried', async (status) => {
    fetchMock.mockResolvedValue(new Response('', { status }));

    expect((await failure(source)).retryable).toBe(true);
  });

  it('lets a network error be retried', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    expect((await failure(source)).retryable).toBe(true);
  });

  it('gives up for good on an answer that is not an image', async () => {
    fetchMock.mockResolvedValue(
      new Response('<html></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    );

    expect((await failure(source)).retryable).toBe(false);
  });

  it('gives up for good when the declared size is over the cap', async () => {
    fetchMock.mockResolvedValue(
      image(new Uint8Array([1]), {
        'content-length': String(MAX_SCREENSHOT_BYTES + 1),
      }),
    );

    expect((await failure(source)).retryable).toBe(false);
  });

  it('gives up for good when the body is over the cap and declared nothing', async () => {
    fetchMock.mockResolvedValue(
      image(new Uint8Array(MAX_SCREENSHOT_BYTES + 1)),
    );

    expect((await failure(source)).retryable).toBe(false);
  });
});
