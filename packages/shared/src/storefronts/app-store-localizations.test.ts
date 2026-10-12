import { describe, expect, it } from 'vitest';

import {
  APP_STORE_LOCALIZATION_IDS,
  APP_STORE_LOCALIZATIONS,
  APP_STORE_STOREFRONT_LOCALIZATIONS,
  APP_STORE_STOREFRONTS,
  isAppStoreLocalization,
  nativeLocalizations,
  readLocalizations,
  readsLocalization,
  storefrontLocalizations,
  storefrontsReading,
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

describe('nativeLocalizations', () => {
  it('names the native localization an english default storefront reads', () => {
    expect(nativeLocalizations('pl')).toEqual(['pl']);
    expect(nativeLocalizations('tr')).toEqual(['tr']);
    expect(nativeLocalizations('no')).toEqual(['no']);
    expect(nativeLocalizations('sg')).toEqual(['zh-Hans']);
    expect(nativeLocalizations('bz')).toEqual(['es-MX']);
    expect(nativeLocalizations('ca')).toEqual(['fr-CA']);
  });

  it('keeps every native localization of a storefront in table order', () => {
    expect(nativeLocalizations('be')).toEqual(['nl', 'fr']);
    expect(nativeLocalizations('ua')).toEqual(['ru', 'uk']);
    expect(nativeLocalizations('in')).toHaveLength(11);
  });

  it('names none for a native default, an english only storefront or the united states', () => {
    for (const country of ['de', 'fr', 'jp', 'ch', 'gb', 'au', 'us']) {
      expect(nativeLocalizations(country)).toEqual([]);
    }
  });

  it('accepts an upper case code and refuses an unknown one', () => {
    expect(nativeLocalizations('PL')).toEqual(['pl']);
    expect(nativeLocalizations('zz')).toEqual([]);
  });

  it('applies to exactly 65 storefronts', () => {
    const covered = APP_STORE_STOREFRONTS.filter(
      (country) => nativeLocalizations(country).length > 0,
    );
    expect(covered).toHaveLength(65);
    expect(covered).toEqual(
      expect.arrayContaining([
        'pl',
        'tr',
        'cz',
        'gr',
        'ua',
        'vn',
        'th',
        'id',
        'my',
        'sa',
        'ae',
        'il',
        'in',
        'ca',
      ]),
    );
    expect(covered).not.toContain('us');
  });

  it('never names an english localization', () => {
    for (const country of APP_STORE_STOREFRONTS) {
      for (const localization of nativeLocalizations(country)) {
        expect(localization.startsWith('en')).toBe(false);
      }
    }
  });
});

describe('readLocalizations', () => {
  it('lists the default localization first and then the additional ones', () => {
    expect(readLocalizations('de')).toEqual(['de', 'en-GB']);
    expect(readLocalizations('ch')).toEqual(['de', 'en-GB', 'fr', 'it']);
    expect(readLocalizations('us')[0]).toBe('en-US');
    expect(readLocalizations('us')).toContain('es-MX');
  });

  it('reads nothing for a code that is not a storefront', () => {
    expect(readLocalizations('zz')).toEqual([]);
  });

  it('reads at least the default localization in every storefront', () => {
    for (const country of APP_STORE_STOREFRONTS) {
      expect(readLocalizations(country).length).toBeGreaterThan(0);
    }
  });
});

describe('readsLocalization', () => {
  it.each([
    ['at', 'de', true],
    ['jp', 'en-US', true],
    ['us', 'de', false],
    ['us', 'not-a-tag', false],
  ] as const)('%s reads %s: %s', (country, localization, expected) => {
    expect(readsLocalization(country, localization)).toBe(expected);
  });
});

describe('storefrontsReading', () => {
  it.each([
    ['es-MX', ['us', 'gb', 'mx'], ['us', 'mx']],
    ['en-US', ['jp', 'us', 'gb'], ['jp', 'us']],
    ['ja', ['us', 'pl'], []],
    ['pl', ['zz', 'pl'], ['pl']],
  ] as const)(
    'finds where %s is read among %j',
    (localization, countries, expected) => {
      expect(storefrontsReading(localization, countries)).toEqual(expected);
    },
  );
});
