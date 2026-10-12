import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  APP_LOCALIZATION_ORIGINS,
  LOCALIZATION_READ_ROLES,
  type AppLocalizationItem,
  type AppLocalizationOrigin,
  type AppLocalizationsResult,
  type AppStoreLocalization,
  type KeywordFieldSavePreview,
  type KeywordImportQuota,
  type LocalizationReader,
  type LocalizationReadRole,
  type MarketLocalizationRead,
} from '../index';

describe('the app localization vocabulary', () => {
  it('lists the origins once, home first', () => {
    expect(APP_LOCALIZATION_ORIGINS).toEqual(['home', 'manual', 'detected']);
  });

  it('lists the read roles once, default first', () => {
    expect(LOCALIZATION_READ_ROLES).toEqual(['default', 'additional']);
  });
});

describe('the app localization contract', () => {
  it('types a localization item with the closed vocabularies', () => {
    expectTypeOf<
      AppLocalizationItem['localization']
    >().toEqualTypeOf<AppStoreLocalization>();
    expectTypeOf<
      AppLocalizationItem['origin']
    >().toEqualTypeOf<AppLocalizationOrigin>();
    expectTypeOf<
      LocalizationReader['role']
    >().toEqualTypeOf<LocalizationReadRole>();
    expectTypeOf<AppLocalizationItem['updatedAt']>().toEqualTypeOf<
      string | null
    >();
  });

  it('lets a market read name an unshipped localization with no origin', () => {
    const read: MarketLocalizationRead = {
      localization: 'es-MX',
      role: 'additional',
      shipped: false,
      origin: null,
      phrases: [],
      charactersUsed: 0,
      charactersLimit: 100,
    };

    expect(read.origin).toBeNull();
    expectTypeOf<
      MarketLocalizationRead['origin']
    >().toEqualTypeOf<AppLocalizationOrigin | null>();
  });

  it('reuses the import quota in a save preview', () => {
    expectTypeOf<
      KeywordFieldSavePreview['quota']
    >().toEqualTypeOf<KeywordImportQuota | null>();
  });

  it('builds a result from the home country, the markets and the items', () => {
    const result: AppLocalizationsResult = {
      home: 'us',
      markets: ['us', 'mx'],
      localizations: [],
    };

    expect(result.markets[0]).toBe(result.home);
  });
});
