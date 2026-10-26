import { Logger } from '@nestjs/common';
import sharp from 'sharp';
import {
  ICON_PIXEL_TOLERANCE,
  ICON_RENDITION_WIDTH,
  IconImageSource,
  MAX_ICON_BYTES,
} from './icon-image.source';
import { ScreenshotImageSource } from './screenshot-image.source';

const ICON_IN =
  'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/4c/94/fc/4c94fc14-695c-d7d4-d8cc-ea2a3d8d8c66/AppIcon-0-0-1x_U007emarketing-0-8-85-220.png/512x512bb.jpg';
const ICON_OUT = ICON_IN.replace(
  /\/\d+x\d+bb\.jpg$/,
  `/${ICON_RENDITION_WIDTH}x0w.jpg`,
);

const image = (bytes: Buffer, headers: Record<string, string> = {}) =>
  new Response(new Uint8Array(bytes), {
    status: 200,
    headers: { 'content-type': 'image/jpeg', ...headers },
  });

const pngOf = (
  width: number,
  color: { r: number; g: number; b: number },
): Promise<Buffer> =>
  sharp({
    create: { width, height: width, channels: 3, background: color },
  })
    .png()
    .toBuffer();

const pngOfPixels = (pixels: {
  r: number;
  g: number;
  b: number;
}): Promise<Buffer> => {
  const pixel = [pixels.r, pixels.g, pixels.b];
  return sharp(Buffer.from([...pixel, ...pixel, ...pixel, ...pixel]), {
    raw: { width: 2, height: 2, channels: 3 },
  })
    .png()
    .toBuffer();
};

const samePictureDifferentBytes = async (): Promise<{
  jpeg: Buffer;
  png: Buffer;
}> => {
  const jpeg = await sharp({
    create: {
      width: 8,
      height: 8,
      channels: 3,
      background: { r: 255, g: 0, b: 0 },
    },
  })
    .jpeg()
    .toBuffer();
  const decoded = await sharp(jpeg).raw().toBuffer({ resolveWithObject: true });
  const png = await sharp(decoded.data, {
    raw: {
      width: decoded.info.width,
      height: decoded.info.height,
      channels: decoded.info.channels,
    },
  })
    .png()
    .toBuffer();
  return { jpeg, png };
};

describe('IconImageSource', () => {
  const fetchMock = jest.spyOn(globalThis, 'fetch');
  const warn = jest
    .spyOn(Logger.prototype, 'warn')
    .mockImplementation(() => {});
  let source: IconImageSource;

  beforeEach(() => {
    fetchMock.mockReset();
    warn.mockClear();
    source = new IconImageSource(new ScreenshotImageSource());
  });
  afterAll(() => {
    fetchMock.mockRestore();
    warn.mockRestore();
  });

  it('answers true for two addresses that draw the same picture', async () => {
    const { jpeg, png } = await samePictureDifferentBytes();
    fetchMock
      .mockResolvedValueOnce(image(jpeg))
      .mockResolvedValueOnce(image(png));

    await expect(source.compare(ICON_IN, ICON_IN)).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([address]) => address)).toEqual([
      ICON_OUT,
      ICON_OUT,
    ]);
  });

  it('answers true when every channel sits within the tolerance', async () => {
    fetchMock
      .mockResolvedValueOnce(
        image(await pngOfPixels({ r: 255, g: 0, b: 0 }), {
          'content-type': 'image/png',
        }),
      )
      .mockResolvedValueOnce(
        image(
          await pngOfPixels({
            r: 255 - ICON_PIXEL_TOLERANCE,
            g: ICON_PIXEL_TOLERANCE,
            b: 1,
          }),
          { 'content-type': 'image/png' },
        ),
      );

    await expect(source.compare(ICON_IN, ICON_IN)).resolves.toBe(true);
  });

  it('answers false when a channel moves past the tolerance', async () => {
    fetchMock
      .mockResolvedValueOnce(
        image(await pngOfPixels({ r: 255, g: 0, b: 0 }), {
          'content-type': 'image/png',
        }),
      )
      .mockResolvedValueOnce(
        image(
          await pngOfPixels({
            r: 255 - ICON_PIXEL_TOLERANCE - 1,
            g: 0,
            b: 0,
          }),
          { 'content-type': 'image/png' },
        ),
      );

    await expect(source.compare(ICON_IN, ICON_IN)).resolves.toBe(false);
  });

  it('answers false when the pictures differ', async () => {
    fetchMock
      .mockResolvedValueOnce(
        image(await pngOf(8, { r: 255, g: 0, b: 0 }), {
          'content-type': 'image/png',
        }),
      )
      .mockResolvedValueOnce(
        image(await pngOf(8, { r: 0, g: 255, b: 0 }), {
          'content-type': 'image/png',
        }),
      );

    await expect(source.compare(ICON_IN, ICON_IN)).resolves.toBe(false);
  });

  it('answers false when the sizes differ', async () => {
    const { jpeg } = await samePictureDifferentBytes();
    const wide = await pngOf(16, { r: 255, g: 0, b: 0 });
    fetchMock
      .mockResolvedValueOnce(image(jpeg))
      .mockResolvedValueOnce(image(wide));

    await expect(source.compare(ICON_IN, ICON_IN)).resolves.toBe(false);
  });

  it.each([
    ['a null address', null],
    [
      'an address outside the apple image cdn',
      'https://cdn.example.com/icon.png',
    ],
  ] as const)(
    'answers null without a request for %s',
    async (_label, before) => {
      await expect(source.compare(before, before)).resolves.toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
    },
  );

  it('answers null when a download fails and says so', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    await expect(source.compare(ICON_IN, ICON_IN)).resolves.toBeNull();
    expect(warn).toHaveBeenCalledWith(
      `the icon pixel comparison of ${ICON_OUT} gave up and the change is recorded: the image request failed: fetch failed`,
    );
  });

  it('answers null for an error status', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 404 }));

    await expect(source.compare(ICON_IN, ICON_IN)).resolves.toBeNull();
  });

  it('answers null for an answer that is not an image', async () => {
    fetchMock.mockResolvedValue(
      new Response('<html></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    );

    await expect(source.compare(ICON_IN, ICON_IN)).resolves.toBeNull();
  });

  it('answers null when the declared size is over the cap', async () => {
    const { jpeg } = await samePictureDifferentBytes();
    fetchMock.mockResolvedValue(
      image(jpeg, { 'content-length': String(MAX_ICON_BYTES + 1) }),
    );

    await expect(source.compare(ICON_IN, ICON_IN)).resolves.toBeNull();
  });

  it('answers null when the body passes the cap without declaring it', async () => {
    const cancel = jest.fn();
    let sent = 0;
    fetchMock.mockResolvedValue(
      new Response(
        new ReadableStream({
          pull(controller) {
            sent += 1;
            if (sent > 8) {
              controller.close();
              return;
            }
            controller.enqueue(new Uint8Array(512 * 1024));
          },
          cancel,
        }),
        { status: 200, headers: { 'content-type': 'image/jpeg' } },
      ),
    );

    await expect(source.compare(ICON_IN, ICON_IN)).resolves.toBeNull();
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('downloads a rendition once while the capture keeps comparing', async () => {
    const { jpeg } = await samePictureDifferentBytes();
    fetchMock.mockImplementation(() => Promise.resolve(image(jpeg)));

    await expect(source.compare(ICON_IN, ICON_IN)).resolves.toBe(true);
    await expect(source.compare(ICON_IN, ICON_IN)).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
