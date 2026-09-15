import { describe, expect, it } from 'vitest';

import { DEFAULT_COUNTRY } from '../index';
import {
  APP_STORE_STOREFRONTS,
  assertStorefront,
  GOOGLE_PLAY_STOREFRONTS,
  isStorefront,
  UnknownStorefrontError,
} from './index';

const OFFERED_MARKETS = [
  'us',
  'gb',
  'de',
  'fr',
  'es',
  'it',
  'nl',
  'pl',
  'br',
  'mx',
  'jp',
  'kr',
  'cn',
  'in',
  'au',
  'ca',
];

describe.each([
  ['APP_STORE_STOREFRONTS', APP_STORE_STOREFRONTS, 175],
  ['GOOGLE_PLAY_STOREFRONTS', GOOGLE_PLAY_STOREFRONTS, 225],
])('%s', (_, list, size) => {
  it(`holds ${size} unique codes`, () => {
    expect(list).toHaveLength(size);
    expect(new Set(list).size).toBe(size);
  });

  it('holds sorted lowercase two letter codes', () => {
    expect(list.every((code) => /^[a-z]{2}$/.test(code))).toBe(true);
    expect([...list].sort()).toEqual(list);
  });

  it('holds every market the product offers and the default', () => {
    expect(list).toEqual(
      expect.arrayContaining([...OFFERED_MARKETS, DEFAULT_COUNTRY]),
    );
  });
});

describe('isStorefront', () => {
  it.each(['us', 'gb', 'xk', 'ng', 'ne', 'bo', 'pw', 'cn'])(
    'knows %j is an App Store storefront',
    (country) => {
      expect(isStorefront('APP_STORE', country)).toBe(true);
    },
  );

  it.each(['zz', 'xx', 'uk', 'eu', 'kp', 'sy', 'ad', 'bd'])(
    'knows %j is not an App Store storefront',
    (country) => {
      expect(isStorefront('APP_STORE', country)).toBe(false);
    },
  );

  it.each(['us', 'gb', 'xk', 'ng', 'ad', 'aq', 'cn'])(
    'knows %j is a Google Play location',
    (country) => {
      expect(isStorefront('GOOGLE_PLAY', country)).toBe(true);
    },
  );

  it.each(['zz', 'xx', 'uk', 'eu', 'kp', 'sy', 'pw'])(
    'knows %j is not a Google Play location',
    (country) => {
      expect(isStorefront('GOOGLE_PLAY', country)).toBe(false);
    },
  );

  it.each(['US', 'usa', 'u', '', ' us'])(
    'refuses %j in either store, since codes are stored lowercase and exact',
    (country) => {
      expect(isStorefront('APP_STORE', country)).toBe(false);
      expect(isStorefront('GOOGLE_PLAY', country)).toBe(false);
    },
  );
});

describe('assertStorefront', () => {
  it('passes a storefront of the store', () => {
    expect(() => assertStorefront('APP_STORE', 'pw')).not.toThrow();
    expect(() => assertStorefront('GOOGLE_PLAY', 'ad')).not.toThrow();
  });

  it.each([
    ['APP_STORE', 'zz', 'zz is not an App Store storefront'],
    ['GOOGLE_PLAY', 'pw', 'pw is not a Google Play location'],
  ] as const)(
    'refuses %s %j with a message that names the store',
    (store, country, message) => {
      let thrown: unknown;
      try {
        assertStorefront(store, country);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(UnknownStorefrontError);
      expect(thrown).toMatchObject({ store, country, message });
    },
  );
});
