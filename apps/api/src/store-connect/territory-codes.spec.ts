import { APP_STORE_STOREFRONTS } from '@asobeast/shared';
import { countryOfTerritory } from './territory-codes';

const names = new Intl.DisplayNames(['en'], { type: 'region' });

describe('countryOfTerritory', () => {
  it('resolves the English display name of every App Store storefront', () => {
    const unresolved = APP_STORE_STOREFRONTS.filter(
      (code) => countryOfTerritory(names.of(code.toUpperCase()) ?? '') !== code,
    );

    expect(unresolved).toEqual([]);
    expect(countryOfTerritory('United States')).toBe('us');
    expect(countryOfTerritory('germany')).toBe('de');
    expect(countryOfTerritory('  GERMANY ')).toBe('de');
  });

  it.each([
    ['USA', 'us'],
    ['United States of America', 'us'],
    ['Korea, Republic of', 'kr'],
    ['Republic of Korea', 'kr'],
    ['Turkey', 'tr'],
    ['Türkiye', 'tr'],
    ['Hong Kong SAR', 'hk'],
    ['Hong Kong', 'hk'],
    ['Macau', 'mo'],
    ['Taiwan', 'tw'],
    ['Russia', 'ru'],
    ['Russian Federation', 'ru'],
    ['Viet Nam', 'vn'],
    ['Czech Republic', 'cz'],
    ['Czechia', 'cz'],
    ['Antigua and Barbuda', 'ag'],
    ['Saint Kitts and Nevis', 'kn'],
    ["Cote d'Ivoire", 'ci'],
    ['United Kingdom', 'gb'],
    ['UK', 'gb'],
  ])('resolves the alias %s', (territory, code) => {
    expect(countryOfTerritory(territory)).toBe(code);
  });

  it('reads a storefront code as itself', () => {
    expect(countryOfTerritory('US')).toBe('us');
    expect(countryOfTerritory('pl')).toBe('pl');
  });

  it('answers null for an unknown territory', () => {
    expect(countryOfTerritory('Atlantis')).toBeNull();
    expect(countryOfTerritory('')).toBeNull();
    expect(countryOfTerritory('zz')).toBeNull();
  });
});
