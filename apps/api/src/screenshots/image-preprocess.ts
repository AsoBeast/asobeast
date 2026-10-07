import sharp from 'sharp';

export const OCR_IMAGE_WIDTH = 1080;
export const MAX_INPUT_PIXELS = 50_000_000;

sharp.cache(false);
sharp.concurrency(1);

export interface PreparedImage {
  image: Buffer;
  height: number;
}

export async function prepareForOcr(bytes: Buffer): Promise<PreparedImage> {
  const { data, info } = await sharp(bytes, {
    failOn: 'error',
    limitInputPixels: MAX_INPUT_PIXELS,
  })
    .resize({ width: OCR_IMAGE_WIDTH })
    .greyscale()
    .normalise()
    .toColourspace('b-w')
    .png({ compressionLevel: 1 })
    .toBuffer({ resolveWithObject: true });
  return { image: data, height: info.height };
}
