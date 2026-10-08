import sharp from 'sharp';
import {
  OCR_IMAGE_WIDTH,
  prepareForOcr,
  MAX_INPUT_PIXELS,
} from './image-preprocess';

const solid = (width: number, height: number, format: 'png' | 'jpeg') =>
  sharp({
    create: { width, height, channels: 3, background: '#7b8cff' },
  })
    [format]()
    .toBuffer();

const passImages = async (bytes: Buffer) =>
  (await prepareForOcr(bytes)).passes.map((pass) => pass.image);

describe('prepareForOcr', () => {
  it('reads a grey pass with otsu and an inverted pass with sauvola', async () => {
    const prepared = await prepareForOcr(await solid(540, 1170, 'png'));

    expect(prepared.passes.map((pass) => pass.thresholding)).toEqual([
      'otsu',
      'sauvola',
    ]);
  });

  it('scales a narrow image up to the ocr width and reports its height', async () => {
    const prepared = await prepareForOcr(await solid(540, 1170, 'png'));

    expect(prepared.height).toBe(2340);
    for (const pass of prepared.passes) {
      const { width, height } = await sharp(pass.image).metadata();
      expect(width).toBe(OCR_IMAGE_WIDTH);
      expect(height).toBe(prepared.height);
    }
  });

  it('scales a wide image down to the ocr width', async () => {
    for (const image of await passImages(await solid(2160, 4680, 'jpeg'))) {
      expect((await sharp(image).metadata()).width).toBe(OCR_IMAGE_WIDTH);
    }
  });

  it('hands the engine a single channel png in every pass', async () => {
    for (const image of await passImages(await solid(1080, 100, 'png'))) {
      const metadata = await sharp(image).metadata();
      expect(metadata.format).toBe('png');
      expect(metadata.channels).toBe(1);
    }
  });

  it('reads a greyscale jpeg in both passes', async () => {
    const grey = await sharp({
      create: { width: 540, height: 100, channels: 3, background: '#808080' },
    })
      .greyscale()
      .jpeg()
      .toBuffer();

    const prepared = await prepareForOcr(grey);

    expect(prepared.passes).toHaveLength(2);
    expect(prepared.height).toBe(200);
  });

  it('turns white text dark and a colour band light in the inverted pass', async () => {
    const white = await sharp({
      create: { width: 1, height: 1, channels: 3, background: '#ffffff' },
    })
      .png()
      .toBuffer();
    const band = await sharp({
      create: { width: 2, height: 1, channels: 3, background: '#ff8a00' },
    })
      .composite([{ input: white, left: 0, top: 0 }])
      .png()
      .toBuffer();

    const [, inverted] = await passImages(band);
    const pixels = await sharp(inverted)
      .resize({ width: 2, height: 1, kernel: 'nearest' })
      .extractChannel(0)
      .raw()
      .toBuffer();

    expect(pixels[0]).toBeLessThan(pixels[1]);
  });

  it('marks every pass with a print resolution', async () => {
    for (const image of await passImages(await solid(540, 100, 'png'))) {
      expect((await sharp(image).metadata()).density).toBe(72);
    }
  });

  it('refuses bytes that are not an image', async () => {
    await expect(prepareForOcr(Buffer.from('<html></html>'))).rejects.toThrow();
  });

  it('accepts a webp image', async () => {
    const webp = await sharp({
      create: { width: 540, height: 100, channels: 3, background: '#7b8cff' },
    })
      .webp()
      .toBuffer();

    await expect(prepareForOcr(webp)).resolves.toMatchObject({ height: 200 });
  });

  it('refuses an svg even though it decodes', async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="540" height="100"><rect width="540" height="100"/></svg>',
    );

    await expect(prepareForOcr(svg)).rejects.toThrow(/jpeg, png or webp/);
  });

  it('refuses a gif even though it decodes', async () => {
    const gif = await sharp({
      create: { width: 540, height: 100, channels: 3, background: '#000' },
    })
      .gif()
      .toBuffer();

    await expect(prepareForOcr(gif)).rejects.toThrow(/jpeg, png or webp/);
  });

  it('refuses an image past the pixel cap', async () => {
    const edge = Math.ceil(Math.sqrt(MAX_INPUT_PIXELS)) + 1;
    const huge = await sharp({
      create: { width: edge, height: edge, channels: 3, background: '#000' },
    })
      .png({ compressionLevel: 9 })
      .toBuffer();

    await expect(prepareForOcr(huge)).rejects.toThrow();
  });
});
