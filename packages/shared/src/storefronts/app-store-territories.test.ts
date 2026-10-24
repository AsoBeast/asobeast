import { describe, expect, it } from 'vitest';

import { APP_STORE_STOREFRONTS, appStoreTerritoryOf } from './index';

describe('appStoreTerritoryOf', () => {
  it('answers an alpha-3 code for every app store storefront', () => {
    expect(
      APP_STORE_STOREFRONTS.every((code) => appStoreTerritoryOf(code) !== null),
    ).toBe(true);
  });

  it('answers distinct codes', () => {
    const codes = new Set(APP_STORE_STOREFRONTS.map(appStoreTerritoryOf));

    expect(codes.size).toBe(APP_STORE_STOREFRONTS.length);
  });

  it('answers three upper case letters', () => {
    for (const code of APP_STORE_STOREFRONTS) {
      expect(appStoreTerritoryOf(code)).toMatch(/^[A-Z]{3}$/);
    }
  });

  it.each([
    ['us', 'USA'],
    ['de', 'DEU'],
    ['gb', 'GBR'],
    ['kr', 'KOR'],
    ['tw', 'TWN'],
    ['hk', 'HKG'],
    ['ae', 'ARE'],
    ['ch', 'CHE'],
    ['cz', 'CZE'],
    ['tr', 'TUR'],
    ['vn', 'VNM'],
    ['za', 'ZAF'],
    ['kh', 'KHM'],
    ['mo', 'MAC'],
    ['me', 'MNE'],
    ['mk', 'MKD'],
    ['cg', 'COG'],
    ['cd', 'COD'],
    ['xk', 'XKS'],
  ])('spells %s as apple names its territory %s', (storefront, territory) => {
    expect(appStoreTerritoryOf(storefront)).toBe(territory);
  });

  it('is case insensitive', () => {
    expect(appStoreTerritoryOf('US')).toBe('USA');
  });

  it.each(['zz', 'uk', '', 'constructor', '__proto__'])(
    'answers null for %j',
    (country) => {
      expect(appStoreTerritoryOf(country)).toBeNull();
    },
  );
});
