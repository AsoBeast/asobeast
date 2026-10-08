import { APP_STORE_STOREFRONTS, nativeLocalizations } from '@asobeast/shared';
import { lookupLanguage, pageLanguage } from './app-store-languages';

const LOOKUP = /^[a-z]{2}(?:[_-][A-Za-z]{2})?$/;
const PAGE = /^[a-z]{2}(?:-[A-Z][A-Za-z]+)?$/;

const NATIVE = [
  ...new Set(
    APP_STORE_STOREFRONTS.flatMap((country) => nativeLocalizations(country)),
  ),
];

describe('app store language parameters', () => {
  it('asks the lookup for norwegian and simplified chinese the way it accepts them', () => {
    expect(lookupLanguage('no')).toBe('nb');
    expect(lookupLanguage('zh-Hans')).toBe('zh_cn');
    expect(pageLanguage('no')).toBe('nb');
    expect(pageLanguage('zh-Hans')).toBe('zh-Hans');
  });

  it('passes every other tag through', () => {
    expect(lookupLanguage('pl')).toBe('pl');
    expect(lookupLanguage('es-MX')).toBe('es-MX');
    expect(pageLanguage('fr-CA')).toBe('fr-CA');
  });

  it.each(NATIVE)('has a well formed lookup and page value for %s', (tag) => {
    expect(lookupLanguage(tag)).toMatch(LOOKUP);
    expect(lookupLanguage(tag)).not.toBe('no');
    expect(lookupLanguage(tag)).not.toMatch(/hans|hant/i);
    expect(pageLanguage(tag)).toMatch(PAGE);
  });
});
