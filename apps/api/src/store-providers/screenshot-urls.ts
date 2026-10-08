import { Store } from '@prisma/client';

export const OCR_RENDITION_WIDTH = 1080;

const APPLE_IMAGE_HOST = /(^|\.)mzstatic\.com$/;
const APPLE_IMAGE_SHARD = /^https:\/\/is\d+(?:-ssl)?\.mzstatic\.com\//i;
const APPLE_RENDITION = /\/\d+x\d+[a-z]*(?:-\d+)?\.(?:jpg|jpeg|png|webp)$/i;
const PLAY_RENDITION = /=[^/=?]*$/;

const withoutAppleRendition = (url: string): string =>
  url.replace(APPLE_RENDITION, '');

export function screenshotAssetKey(store: Store, url: string): string {
  return store === Store.APP_STORE
    ? withoutAppleRendition(url).replace(
        APPLE_IMAGE_SHARD,
        'https://mzstatic.com/',
      )
    : url.replace(PLAY_RENDITION, '');
}

export function appleRenditionUrl(
  url: string,
  width = OCR_RENDITION_WIDTH,
): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' || !APPLE_IMAGE_HOST.test(parsed.hostname)) {
    return null;
  }
  return `${withoutAppleRendition(url)}/${width}x0w.jpg`;
}
