import { Store } from '@prisma/client';

export const OCR_RENDITION_WIDTH = 1080;

const APPLE_IMAGE_HOST = /(^|\.)mzstatic\.com$/;
const PLAY_IMAGE_HOST = /^play-lh\.googleusercontent\.com$/;
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

const httpsHost = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.hostname : null;
  } catch {
    return null;
  }
};

export function appleRenditionUrl(
  url: string,
  width = OCR_RENDITION_WIDTH,
): string | null {
  const host = httpsHost(url);
  return host !== null && APPLE_IMAGE_HOST.test(host)
    ? `${withoutAppleRendition(url)}/${width}x0w.jpg`
    : null;
}

export function isStoreImageUrl(url: string): boolean {
  const host = httpsHost(url);
  return (
    host !== null && (APPLE_IMAGE_HOST.test(host) || PLAY_IMAGE_HOST.test(host))
  );
}
