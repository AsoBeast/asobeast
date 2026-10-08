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

type ChunkSource = NonNullable<
  ConstructorParameters<typeof ReadableStream<Uint8Array>>[0]
>;

const streamed = (source: ChunkSource, headers: Record<string, string> = {}) =>
  new Response(new ReadableStream(source), {
    status: 200,
    headers: { 'content-type': 'image/jpeg', ...headers },
  });

const MEGABYTE = 1024 * 1024;

const endlessChunks = (cancel: jest.Mock): ChunkSource => {
  let sent = 0;
  return {
    pull(controller) {
      sent += 1;
      if (sent > 64) {
        controller.close();
        return;
      }
      controller.enqueue(new Uint8Array(MEGABYTE));
    },
    cancel,
  };
};

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

  it('never follows a redirect away from the apple image cdn', async () => {
    fetchMock.mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: 'http://169.254.169.254/latest/meta-data/' },
      }),
    );

    const error = await failure(source);

    expect(fetchMock.mock.calls[0][1]?.redirect).toBe('manual');
    expect(error).toBeInstanceOf(ScreenshotFetchError);
    expect(error.retryable).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a body that times out', new DOMException('timed out', 'TimeoutError')],
    ['a connection reset mid body', new TypeError('terminated')],
  ])('lets %s be retried', async (_label, cause) => {
    fetchMock.mockResolvedValue(
      streamed({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
        },
        pull(controller) {
          controller.error(cause);
        },
      }),
    );

    const error = await failure(source);

    expect(error).toBeInstanceOf(ScreenshotFetchError);
    expect(error.retryable).toBe(true);
  });

  it('stops reading an unlabelled body as soon as it passes the cap', async () => {
    const cancel = jest.fn();
    fetchMock.mockResolvedValue(streamed(endlessChunks(cancel)));

    const error = await failure(source);

    expect(error).toBeInstanceOf(ScreenshotFetchError);
    expect(error.retryable).toBe(false);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('stops reading a body that declares less than it sends', async () => {
    const cancel = jest.fn();
    fetchMock.mockResolvedValue(
      streamed(endlessChunks(cancel), { 'content-length': '1024' }),
    );

    const error = await failure(source);

    expect(error).toBeInstanceOf(ScreenshotFetchError);
    expect(error.retryable).toBe(false);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it.each(['image/png', 'image/webp', 'image/jpeg; charset=binary'])(
    'accepts a %s answer',
    async (type) => {
      fetchMock.mockResolvedValue(
        image(new Uint8Array([1]), { 'content-type': type }),
      );

      await expect(source.read(URL_IN)).resolves.toEqual(Buffer.from([1]));
    },
  );

  it.each(['image/svg+xml', 'image/gif', 'image/tiff'])(
    'gives up for good on a %s answer',
    async (type) => {
      fetchMock.mockResolvedValue(
        image(new Uint8Array([1]), { 'content-type': type }),
      );

      expect((await failure(source)).retryable).toBe(false);
    },
  );

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
