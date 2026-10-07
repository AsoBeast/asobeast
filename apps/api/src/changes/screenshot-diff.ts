import { Store } from '@prisma/client';
import type { ScreenshotImagesDetail, ScreenshotRef } from '@asobeast/shared';
import { extractRawFacts } from '../store-providers/raw-facts';
import { screenshotAssetKey } from '../store-providers/screenshot-urls';

export interface KeyedScreenshot {
  key: string;
  url: string;
}

export interface ImagesDiff {
  added: number[];
  removed: number[];
  reordered: boolean;
}

const positionsWhere = (
  list: readonly KeyedScreenshot[],
  keep: (key: string) => boolean,
): number[] =>
  list.flatMap((item, index) => (keep(item.key) ? [index + 1] : []));

const refs = (list: readonly KeyedScreenshot[]): ScreenshotRef[] =>
  list.map((item, index) => ({ position: index + 1, url: item.url }));

const plural = (count: number): string =>
  `${count} screenshot${count === 1 ? '' : 's'}`;

export function diffScreenshotImages(
  before: readonly KeyedScreenshot[],
  after: readonly KeyedScreenshot[],
): ImagesDiff | null {
  const beforeKeys = new Set(before.map((item) => item.key));
  const afterKeys = new Set(after.map((item) => item.key));
  const added = positionsWhere(after, (key) => !beforeKeys.has(key));
  const removed = positionsWhere(before, (key) => !afterKeys.has(key));
  const keptBefore = before.filter((item) => afterKeys.has(item.key));
  const keptAfter = after.filter((item) => beforeKeys.has(item.key));
  const reordered = keptBefore.some(
    (item, index) => item.key !== keptAfter[index]?.key,
  );
  return added.length === 0 && removed.length === 0 && !reordered
    ? null
    : { added, removed, reordered };
}

export function describeImagesChange(
  beforeCount: number,
  afterCount: number,
  diff: ImagesDiff,
): { before: string; after: string } {
  const replaced = Math.min(diff.added.length, diff.removed.length);
  const parts = [
    plural(afterCount),
    replaced > 0 ? `${replaced} replaced` : null,
    diff.added.length > replaced
      ? `${diff.added.length - replaced} added`
      : null,
    diff.removed.length > replaced
      ? `${diff.removed.length - replaced} removed`
      : null,
    diff.reordered ? 'reordered' : null,
  ];
  return {
    before: plural(beforeCount),
    after: parts.filter((part) => part !== null).join(', '),
  };
}

export function screenshotImagesDetail(
  before: readonly KeyedScreenshot[],
  after: readonly KeyedScreenshot[],
  diff: ImagesDiff,
): ScreenshotImagesDetail {
  return { kind: 'images', before: refs(before), after: refs(after), ...diff };
}

export function screenshotKeys(
  store: Store,
  raw: unknown,
): KeyedScreenshot[] | null {
  const record = typeof raw === 'object' && raw !== null ? raw : null;
  if (record === null || !('screenshots' in record)) return null;
  return extractRawFacts(store, raw).screenshotUrls.map((url) => ({
    key: screenshotAssetKey(store, url),
    url,
  }));
}
