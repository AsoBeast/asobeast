import {
  assertStorefront,
  chartDevicesOf,
  ChartKey,
  defaultChartDevice,
  isChartGenre,
  Store,
} from '@asobeast/shared';
import type { CategoryBucket } from '../category-ranks/category-ranks.service';

const STORE_NAMES: Record<Store, string> = {
  APP_STORE: 'an App Store',
  GOOGLE_PLAY: 'a Google Play',
};

export class UnknownChartKeyError extends Error {}

export class UnknownChartGenreError extends UnknownChartKeyError {
  constructor(
    readonly store: Store,
    readonly genre: string,
  ) {
    super(`${genre} is not ${STORE_NAMES[store]} chart category`);
    this.name = 'UnknownChartGenreError';
  }
}

export class UnknownChartDeviceError extends UnknownChartKeyError {
  constructor(
    readonly store: Store,
    readonly device: string,
  ) {
    super(`${device} is not ${STORE_NAMES[store]} chart device`);
    this.name = 'UnknownChartDeviceError';
  }
}

export function assertChartKey(key: ChartKey): void {
  assertStorefront(key.store, key.country);
  if (!isChartGenre(key.store, key.genre)) {
    throw new UnknownChartGenreError(key.store, key.genre);
  }
  if (!chartDevicesOf(key.store).includes(key.device)) {
    throw new UnknownChartDeviceError(key.store, key.device);
  }
}

export function chartKeyOf(bucket: CategoryBucket): ChartKey {
  return { ...bucket, device: defaultChartDevice(bucket.store) };
}
