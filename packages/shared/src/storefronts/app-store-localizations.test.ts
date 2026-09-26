import { describe, expect, it } from 'vitest';

import {
  APP_STORE_LOCALIZATION_IDS,
  APP_STORE_LOCALIZATIONS,
  APP_STORE_STOREFRONT_LOCALIZATIONS,
  APP_STORE_STOREFRONTS,
  isAppStoreLocalization,
  storefrontLocalizations,
} from './index';

const rows = Object.entries(APP_STORE_STOREFRONT_LOCALIZATIONS);

describe('APP_STORE_STOREFRONT_LOCALIZATIONS', () => {
  it('holds exactly the App Store storefronts', () => {
    expect(Object.keys(APP_STORE_STOREFRONT_LOCALIZATIONS).sort()).toEqual([
      ...APP_STORE_STOREFRONTS,
    ]);
  });

  it.each(rows)('lists each localization of %s once', (_, row) => {
    expect(row.additional).not.toContain(row.primary);
    expect(new Set(row.additional).size).toBe(row.additional.length);
  });

  it('uses every known localization and nothing else', () => {
    const used = new Set(
      rows.flatMap(([, row]) => [row.primary, ...row.additional]),
    );

    expect([...used].every(isAppStoreLocalization)).toBe(true);
    expect([...used].sort()).toEqual([...APP_STORE_LOCALIZATION_IDS].sort());
  });

  it('has the shape of the table Apple publishes', () => {
    expect(APP_STORE_LOCALIZATION_IDS).toHaveLength(50);
    expect(rows.filter(([, row]) => row.additional.length > 0)).toHaveLength(
      104,
    );
    expect(
      rows.filter(
        ([, row]) => row.primary === 'en-GB' && row.additional.length === 0,
      ),
    ).toHaveLength(71);
  });

  it.each([
    [
      'us',
      'en-US',
      ['ar', 'zh-Hans', 'zh-Hant', 'fr', 'ko', 'pt-BR', 'ru', 'es-MX', 'vi'],
    ],
    ['gb', 'en-GB', []],
    ['ca', 'en-CA', ['fr-CA']],
    [
      'in',
      'en-GB',
      ['bn', 'gu', 'hi', 'kn', 'ml', 'mr', 'or', 'pa', 'ta', 'te', 'ur'],
    ],
    ['ch', 'de', ['en-GB', 'fr', 'it']],
    ['jp', 'ja', ['en-US']],
    ['ua', 'en-GB', ['ru', 'uk']],
    ['cn', 'zh-Hans', ['en-GB']],
    ['no', 'en-GB', ['no']],
  ] as const)('reads %s as Apple lists it', (country, primary, additional) => {
    expect(storefrontLocalizations(country)).toEqual({ primary, additional });
  });
});

describe('storefrontLocalizations', () => {
  it('ignores the case of the storefront code', () => {
    expect(storefrontLocalizations('US')).toBe(
      APP_STORE_STOREFRONT_LOCALIZATIONS.us,
    );
  });

  it.each(['zz', 'uk', '', 'constructor', '__proto__'])(
    'returns null for %j',
    (country) => {
      expect(storefrontLocalizations(country)).toBeNull();
    },
  );
});

describe('isAppStoreLocalization', () => {
  it.each(['es-MX', 'zh-Hans', 'no', 'en-US'])('accepts %s', (value) => {
    expect(isAppStoreLocalization(value)).toBe(true);
  });

  it.each(['es-mx', 'en', 'toString', '', 42, null])('refuses %j', (value) => {
    expect(isAppStoreLocalization(value)).toBe(false);
  });

  it('keeps the order and the labels of Apple list', () => {
    expect(APP_STORE_LOCALIZATION_IDS.slice(0, 4)).toEqual([
      'ar',
      'bn',
      'ca',
      'zh-Hans',
    ]);
    expect(APP_STORE_LOCALIZATIONS['en-US']).toBe('English (U.S.)');
    expect(APP_STORE_LOCALIZATIONS.sl).toBe('Slovenian');
  });
});
