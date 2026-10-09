import {
  nativeLocalizations,
  storefrontLocalizations,
} from './app-store-localizations';
import type { AppStoreLocalization } from './app-store-localizations';
import { storefrontLanguage } from './languages';

const ENGLISH = 'en';

const languageOf = (localization: string): string => localization.split('-')[0];

function localizationsRead(country: string): readonly AppStoreLocalization[] {
  const localizations = storefrontLocalizations(country);
  if (localizations === null || languageOf(localizations.primary) === ENGLISH) {
    return nativeLocalizations(country);
  }
  return [
    localizations.primary,
    ...localizations.additional.filter(
      (localization) => languageOf(localization) !== ENGLISH,
    ),
  ];
}

export function marketLanguages(country: string): readonly string[] {
  const own = storefrontLanguage(country);
  return [
    ...new Set([
      ...localizationsRead(country).map(languageOf),
      ...(own === null || own === ENGLISH ? [] : [own]),
    ]),
  ];
}
