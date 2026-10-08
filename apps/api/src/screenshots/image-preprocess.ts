import sharp, { type Sharp } from 'sharp';
import { OCR_RENDITION_WIDTH } from '../store-providers/screenshot-urls';
import type { OcrThresholding } from './ocr-engine';

export const OCR_IMAGE_WIDTH = OCR_RENDITION_WIDTH;
export const MAX_INPUT_PIXELS = 50_000_000;

const OCR_FORMATS = new Set(['jpeg', 'png', 'webp']);
const OCR_DENSITY = 72;
const RGB_CHANNELS = 3;

sharp.cache(false);
sharp.concurrency(1);

export interface PreparedPass {
  image: Buffer;
  thresholding: OcrThresholding;
}

export interface PreparedImage {
  height: number;
  passes: PreparedPass[];
}

const toPng = (image: Sharp): Promise<Buffer> =>
  image
    .normalise()
    .toColourspace('b-w')
    .withDensity(OCR_DENSITY)
    .png({ compressionLevel: 1 })
    .toBuffer();

function invertedMinimum(rgb: Buffer): Buffer {
  const pixels = Buffer.allocUnsafe(rgb.length / RGB_CHANNELS);
  for (let source = 0, target = 0; source < rgb.length; target++) {
    pixels[target] =
      255 - Math.min(rgb[source++], rgb[source++], rgb[source++]);
  }
  return pixels;
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
    .removeAlpha()
    .toColourspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const [grey, inverted] = await Promise.all([
    toPng(
      sharp(data, {
        raw: { width, height, channels: RGB_CHANNELS },
      }).greyscale(),
    ),
    toPng(
      sharp(invertedMinimum(data), { raw: { width, height, channels: 1 } }),
    ),
  ]);
  return {
    height,
    passes: [
      { image: grey, thresholding: 'otsu' },
      { image: inverted, thresholding: 'sauvola' },
    ],
  };
}
