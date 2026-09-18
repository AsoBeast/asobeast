import type { Store } from '../index';
import { APP_STORE_STOREFRONTS } from './app-store';
import { GOOGLE_PLAY_STOREFRONTS } from './google-play';
import { STOREFRONT_LANGUAGES, storefrontLanguage } from './languages';

export {
  APP_STORE_STOREFRONTS,
  GOOGLE_PLAY_STOREFRONTS,
  STOREFRONT_LANGUAGES,
  storefrontLanguage,
};

const STOREFRONTS: Record<Store, ReadonlySet<string>> = {
  APP_STORE: new Set(APP_STORE_STOREFRONTS),
  GOOGLE_PLAY: new Set(GOOGLE_PLAY_STOREFRONTS),
};

const STOREFRONT_NOUN: Record<Store, string> = {
  APP_STORE: 'an App Store storefront',
  GOOGLE_PLAY: 'a Google Play location',
};

export class UnknownStorefrontError extends Error {
  constructor(
    readonly store: Store,
    readonly country: string,
  ) {
    super(`${country} is not ${STOREFRONT_NOUN[store]}`);
    this.name = 'UnknownStorefrontError';
  }
}

export function isStorefront(store: Store, country: string): boolean {
  return STOREFRONTS[store].has(country);
}

export function assertStorefront(store: Store, country: string): void {
  if (!isStorefront(store, country)) {
    throw new UnknownStorefrontError(store, country);
  }
}
