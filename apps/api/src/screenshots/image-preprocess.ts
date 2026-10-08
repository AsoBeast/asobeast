import sharp from 'sharp';
import { OCR_RENDITION_WIDTH } from '../store-providers/screenshot-urls';

export const OCR_IMAGE_WIDTH = OCR_RENDITION_WIDTH;
export const MAX_INPUT_PIXELS = 50_000_000;

const OCR_FORMATS = new Set(['jpeg', 'png', 'webp']);

sharp.cache(false);
sharp.concurrency(1);

export interface PreparedImage {
  image: Buffer;
  height: number;
}

export async function prepareForOcr(bytes: Buffer): Promise<PreparedImage> {
  const decoder = sharp(bytes, {
    failOn: 'error',
    limitInputPixels: MAX_INPUT_PIXELS,
  });
  const { format } = await decoder.metadata();
  if (!OCR_FORMATS.has(format)) {
    throw new Error(`the screenshot is ${format}, not jpeg, png or webp`);
  }
  const { data, info } = await decoder
    .resize({ width: OCR_IMAGE_WIDTH })
    .greyscale()
    .normalise()
    .toColourspace('b-w')
    .png({ compressionLevel: 1 })
    .toBuffer({ resolveWithObject: true });
  return { image: data, height: info.height };
}
