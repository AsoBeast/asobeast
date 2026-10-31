import { APP_STORE_LOCALIZATION_IDS } from '@asobeast/shared';
import { localizationOfAscLocale } from './asc-locales';

const APPLE_APP_STORE_LOCALIZATIONS: Record<string, string> = {
  'ar-SA': 'ar',
  'bn-BD': 'bn',
  ca: 'ca',
  'zh-Hans': 'zh-Hans',
  'zh-Hant': 'zh-Hant',
  hr: 'hr',
  cs: 'cs',
  da: 'da',
  'nl-NL': 'nl',
  'en-AU': 'en-AU',
  'en-CA': 'en-CA',
  'en-GB': 'en-GB',
  'en-US': 'en-US',
  fi: 'fi',
  'fr-CA': 'fr-CA',
  'fr-FR': 'fr',
  'de-DE': 'de',
  el: 'el',
  'gu-IN': 'gu',
  he: 'he',
  hi: 'hi',
  hu: 'hu',
  id: 'id',
  it: 'it',
  ja: 'ja',
  'kn-IN': 'kn',
  ko: 'ko',
  ms: 'ms',
  'ml-IN': 'ml',
  'mr-IN': 'mr',
  no: 'no',
  'or-IN': 'or',
  pl: 'pl',
  'pt-BR': 'pt-BR',
  'pt-PT': 'pt-PT',
  'pa-IN': 'pa',
  ro: 'ro',
  ru: 'ru',
  sk: 'sk',
  'sl-SI': 'sl',
  'es-MX': 'es-MX',
  'es-ES': 'es-ES',
  sv: 'sv',
  'ta-IN': 'ta',
  'te-IN': 'te',
  th: 'th',
  tr: 'tr',
  uk: 'uk',
  'ur-PK': 'ur',
  vi: 'vi',
};

describe('localizationOfAscLocale', () => {
  it('maps every locale of the App Store Connect localization list', () => {
    for (const [locale, localization] of Object.entries(
      APPLE_APP_STORE_LOCALIZATIONS,
    )) {
      expect(localizationOfAscLocale(locale)).toBe(localization);
    }
  });

  it('maps the regional forms of the 2025 languages Apple added', () => {
    expect(localizationOfAscLocale('bn-BD')).toBe('bn');
    expect(localizationOfAscLocale('sl-SI')).toBe('sl');
    expect(localizationOfAscLocale('ur-PK')).toBe('ur');
  });

  it('maps the bare forms of the regional App Store locales too', () => {
    expect(localizationOfAscLocale('bn')).toBe('bn');
    expect(localizationOfAscLocale('sl')).toBe('sl');
    expect(localizationOfAscLocale('ar')).toBe('ar');
    expect(localizationOfAscLocale('de')).toBe('de');
    expect(localizationOfAscLocale('fr')).toBe('fr');
    expect(localizationOfAscLocale('nl')).toBe('nl');
    expect(localizationOfAscLocale('es')).toBeNull();
  });

  it('answers every AsoBeast localization from exactly one Apple localization', () => {
    const mapped = new Set(Object.values(APPLE_APP_STORE_LOCALIZATIONS));
    expect([...mapped].sort()).toEqual([...APP_STORE_LOCALIZATION_IDS].sort());
  });

  it('refuses a locale Apple does not serve', () => {
    expect(localizationOfAscLocale('xx-YY')).toBeNull();
    expect(localizationOfAscLocale('de-AT')).toBeNull();
    expect(localizationOfAscLocale('bn-IN')).toBeNull();
  });
});
