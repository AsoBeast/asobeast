import { Store } from '@prisma/client';
import type { ScreenshotCaptionStatus } from '@asobeast/shared';
import { extractRawFacts } from '../store-providers/raw-facts';
import { screenshotAssetKey } from '../store-providers/screenshot-urls';

export const MAX_RECORDED_SCREENSHOTS = 10;

export interface ScreenshotRow {
  position: number;
  url: string;
  assetKey: string;
  status: ScreenshotCaptionStatus;
}

export function screenshotRows(
  store: Store,
  raw: unknown,
  status: ScreenshotCaptionStatus,
): ScreenshotRow[] {
  return extractRawFacts(store, raw)
    .screenshotUrls.slice(0, MAX_RECORDED_SCREENSHOTS)
    .map((url, index) => ({
      position: index + 1,
      url,
      assetKey: screenshotAssetKey(store, url),
      status,
    }));
}
