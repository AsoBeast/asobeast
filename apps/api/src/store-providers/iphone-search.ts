import { Store } from '@prisma/client';

const IPHONE_SEARCH_DEVICES = /^(iPhone|iPod)/;

export function listedInIphoneSearch(
  supportedDevices: readonly string[] | undefined,
): boolean {
  return (
    supportedDevices === undefined ||
    supportedDevices.some((device) => IPHONE_SEARCH_DEVICES.test(device))
  );
}

export function rawListedInIphoneSearch(store: Store, raw: unknown): boolean {
  if (store !== Store.APP_STORE || typeof raw !== 'object' || raw === null) {
    return true;
  }
  const { supportedDevices } = raw as { supportedDevices?: unknown };
  if (!Array.isArray(supportedDevices)) {
    return true;
  }
  return listedInIphoneSearch(
    supportedDevices.filter(
      (device): device is string => typeof device === 'string',
    ),
  );
}
