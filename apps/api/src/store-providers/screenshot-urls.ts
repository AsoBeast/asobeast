import { Store } from '@prisma/client';

export const OCR_RENDITION_WIDTH = 1080;

const APPLE_IMAGE_HOST = /(^|\.)mzstatic\.com$/;
const APPLE_RENDITION = /\/\d+x\d+[a-z]*\.(?:jpg|jpeg|png|webp)$/i;
const PLAY_RENDITION = /=[^/=?]*$/;

export function screenshotAssetKey(store: Store, url: string): string {
  return url.replace(
    store === Store.APP_STORE ? APPLE_RENDITION : PLAY_RENDITION,
    '',
  );
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
  return `${screenshotAssetKey(Store.APP_STORE, url)}/${width}x0w.jpg`;
}
