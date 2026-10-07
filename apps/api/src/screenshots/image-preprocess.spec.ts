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

describe('prepareForOcr', () => {
  it('scales a narrow image up to the ocr width and reports its height', async () => {
    const prepared = await prepareForOcr(await solid(540, 1170, 'png'));

    const { width, height } = await sharp(prepared.image).metadata();
    expect(width).toBe(OCR_IMAGE_WIDTH);
    expect(height).toBe(prepared.height);
    expect(prepared.height).toBe(2340);
  });

  it('scales a wide image down to the ocr width', async () => {
    const prepared = await prepareForOcr(await solid(2160, 4680, 'jpeg'));

    expect((await sharp(prepared.image).metadata()).width).toBe(
      OCR_IMAGE_WIDTH,
    );
  });

  it('hands the engine a single channel png', async () => {
    const prepared = await prepareForOcr(await solid(1080, 100, 'png'));

    const metadata = await sharp(prepared.image).metadata();
    expect(metadata.format).toBe('png');
    expect(metadata.channels).toBe(1);
  });

  it('refuses bytes that are not an image', async () => {
    await expect(prepareForOcr(Buffer.from('<html></html>'))).rejects.toThrow();
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
