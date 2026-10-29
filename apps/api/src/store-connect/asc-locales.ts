import {
  isAppStoreLocalization,
  type AppStoreLocalization,
} from '@asobeast/shared';

const ASC_LOCALES: Record<string, AppStoreLocalization> = {
  'ar-SA': 'ar',
  ca: 'ca',
  cs: 'cs',
  da: 'da',
  'de-DE': 'de',
  el: 'el',
  'en-AU': 'en-AU',
  'en-CA': 'en-CA',
  'en-GB': 'en-GB',
  'en-US': 'en-US',
  'es-ES': 'es-ES',
  'es-MX': 'es-MX',
  fi: 'fi',
  'fr-CA': 'fr-CA',
  'fr-FR': 'fr',
  he: 'he',
  hi: 'hi',
  hr: 'hr',
  hu: 'hu',
  id: 'id',
  it: 'it',
  ja: 'ja',
  ko: 'ko',
  ms: 'ms',
  'nl-NL': 'nl',
  no: 'no',
  pl: 'pl',
  'pt-BR': 'pt-BR',
  'pt-PT': 'pt-PT',
  ro: 'ro',
  ru: 'ru',
  sk: 'sk',
  sv: 'sv',
  th: 'th',
  tr: 'tr',
  uk: 'uk',
  vi: 'vi',
  'zh-Hans': 'zh-Hans',
  'zh-Hant': 'zh-Hant',
};

export const localizationOfAscLocale = (
  locale: string,
): AppStoreLocalization | null => {
  const mapped = ASC_LOCALES[locale];
  if (mapped) return mapped;
  return isAppStoreLocalization(locale) ? locale : null;
};
