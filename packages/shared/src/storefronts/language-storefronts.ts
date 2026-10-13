import type { LocalizationReadRole } from '../contracts/localizations';
import {
  APP_STORE_STOREFRONT_LOCALIZATIONS,
  type AppStoreLocalization,
  readLocalizations,
} from './app-store-localizations';
import { localizationLanguage } from './market-languages';

const LANGUAGE_ALIASES: Readonly<Record<string, string>> = { nb: 'no' };

const ENGLISH = 'en';

const ROLE_ORDER: Readonly<Record<LocalizationReadRole, number>> = {
  default: 0,
  additional: 1,
};

export const declaredLanguage = (code: string): string => {
  const language = code.toLowerCase();
  return LANGUAGE_ALIASES[language] ?? language;
};

export interface LanguageStorefront {
  country: string;
  localization: AppStoreLocalization;
  language: string;
  role: LocalizationReadRole;
}

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const byRoleThenLanguageThenCountry = (
  left: LanguageStorefront,
  right: LanguageStorefront,
): number =>
  ROLE_ORDER[left.role] - ROLE_ORDER[right.role] ||
  compareText(left.language, right.language) ||
  compareText(left.country, right.country);

function storefrontFor(
  country: string,
  declared: ReadonlySet<string>,
): LanguageStorefront[] {
  const read = readLocalizations(country);
  const index = read.findIndex((tag) =>
    declared.has(localizationLanguage(tag)),
  );
  if (index < 0) return [];
  const localization = read[index];
  return [
    {
      country,
      localization,
      language: localizationLanguage(localization),
      role: index === 0 ? 'default' : 'additional',
    },
  ];
}

export function storefrontsForLanguages(
  languages: readonly string[],
): LanguageStorefront[] {
  const declared = new Set(
    languages.map(declaredLanguage).filter((language) => language !== ENGLISH),
  );
  if (declared.size === 0) return [];
  return Object.keys(APP_STORE_STOREFRONT_LOCALIZATIONS)
    .flatMap((country) => storefrontFor(country, declared))
    .sort(byRoleThenLanguageThenCountry);
}
