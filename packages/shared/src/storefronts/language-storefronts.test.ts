import { describe, expect, it } from 'vitest';

import {
  APP_STORE_STOREFRONT_LOCALIZATIONS,
  declaredLanguage,
  localizationLanguage,
  readsLocalization,
  storefrontsForLanguages,
} from './index';

const countriesOf = (
  languages: readonly string[],
  role: 'default' | 'additional',
): string[] =>
  storefrontsForLanguages(languages)
    .filter((entry) => entry.role === role)
    .map((entry) => entry.country);

describe('declaredLanguage', () => {
  it.each([
    ['DE', 'de'],
    ['NB', 'no'],
    ['no', 'no'],
    ['zh', 'zh'],
  ])('reads %s as %s', (code, language) => {
    expect(declaredLanguage(code)).toBe(language);
  });
});

describe('storefrontsForLanguages', () => {
  it('suggests nothing without a declared language other than english', () => {
    expect(storefrontsForLanguages([])).toEqual([]);
    expect(storefrontsForLanguages(['EN'])).toEqual([]);
  });

  it('suggests nothing for a language no localization has', () => {
    expect(storefrontsForLanguages(['xx'])).toEqual([]);
  });

  it('answers the storefronts that read german, defaults first', () => {
    const german = storefrontsForLanguages(['DE']);
    expect(german).toContainEqual({
      country: 'de',
      localization: 'de',
      language: 'de',
      role: 'default',
    });
    expect(countriesOf(['DE'], 'default')).toEqual(['at', 'ch', 'de']);
    expect(countriesOf(['DE'], 'additional')).toEqual(['lu']);
    expect(german.map((entry) => entry.role)).toEqual([
      'default',
      'default',
      'default',
      'additional',
    ]);
  });

  it('groups french by role and sorts the countries of a group', () => {
    const french = storefrontsForLanguages(['FR']);
    const defaults = countriesOf(['FR'], 'default');
    const additional = countriesOf(['FR'], 'additional');
    expect(defaults).toEqual(expect.arrayContaining(['ci', 'cm', 'fr', 'ga']));
    expect(additional).toEqual(
      expect.arrayContaining(['be', 'ca', 'ch', 'us']),
    );
    expect(defaults).toEqual([...defaults].sort());
    expect(additional).toEqual([...additional].sort());
    expect(french.findIndex((entry) => entry.role === 'additional')).toBe(
      defaults.length,
    );
    expect(french.find((entry) => entry.country === 'ca')).toMatchObject({
      localization: 'fr-CA',
      language: 'fr',
    });
    expect(french.find((entry) => entry.country === 'us')).toMatchObject({
      localization: 'fr',
      role: 'additional',
    });
  });

  it('answers japan alone for japanese', () => {
    expect(storefrontsForLanguages(['JA'])).toEqual([
      { country: 'jp', localization: 'ja', language: 'ja', role: 'default' },
    ]);
  });

  it('reads both chinese scripts as chinese', () => {
    const chinese = storefrontsForLanguages(['ZH']);
    expect(chinese).toEqual(
      expect.arrayContaining([
        {
          country: 'cn',
          localization: 'zh-Hans',
          language: 'zh',
          role: 'default',
        },
        {
          country: 'tw',
          localization: 'zh-Hant',
          language: 'zh',
          role: 'default',
        },
        {
          country: 'hk',
          localization: 'zh-Hant',
          language: 'zh',
          role: 'default',
        },
        {
          country: 'sg',
          localization: 'zh-Hans',
          language: 'zh',
          role: 'additional',
        },
      ]),
    );
    expect(localizationLanguage('zh-Hant')).toBe('zh');
  });

  it('answers both portuguese storefronts', () => {
    expect(countriesOf(['PT'], 'default')).toEqual(['br', 'pt']);
  });

  it('lists a storefront once, by the first localization it reads', () => {
    const both = storefrontsForLanguages(['DE', 'FR']);
    expect(both.filter((entry) => entry.country === 'ch')).toEqual([
      { country: 'ch', localization: 'de', language: 'de', role: 'default' },
    ]);
  });

  it('reads norwegian from its lookup code', () => {
    expect(storefrontsForLanguages(['NB'])).toEqual([
      { country: 'no', localization: 'no', language: 'no', role: 'additional' },
    ]);
  });

  it('only answers storefronts that read the localization they name', () => {
    const every = storefrontsForLanguages(['DE', 'FR', 'ES', 'ZH', 'AR']);
    expect(every.length).toBeGreaterThan(0);
    for (const entry of every) {
      expect(
        Object.hasOwn(APP_STORE_STOREFRONT_LOCALIZATIONS, entry.country),
      ).toBe(true);
      expect(readsLocalization(entry.country, entry.localization)).toBe(true);
    }
  });
});
