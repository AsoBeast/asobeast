import {
  nativeLocalizations,
  storefrontLocalizations,
} from './app-store-localizations';
import type { AppStoreLocalization } from './app-store-localizations';
import { storefrontLanguage } from './languages';

const ENGLISH = 'en';

export const localizationLanguage = (localization: string): string =>
  localization.split('-')[0];

function localizationsRead(country: string): readonly AppStoreLocalization[] {
  const localizations = storefrontLocalizations(country);
  if (
    localizations === null ||
    localizationLanguage(localizations.primary) === ENGLISH
  ) {
    return nativeLocalizations(country);
  }
  return [
    localizations.primary,
    ...localizations.additional.filter(
      (localization) => localizationLanguage(localization) !== ENGLISH,
    ),
  ];
}

export function marketLanguages(country: string): readonly string[] {
  const own = storefrontLanguage(country);
  return [
    ...new Set([
      ...localizationsRead(country).map(localizationLanguage),
      ...(own === null || own === ENGLISH ? [] : [own]),
    ]),
  ];
}
