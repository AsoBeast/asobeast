import {
  APP_STORE_LOCALIZATIONS,
  type AppStoreLocalization,
  keywordFieldLocalizations,
  type LocalizationReader,
  type LocalizationReadRole,
} from '@asobeast/shared';

export const homeLocalization = (home: string): AppStoreLocalization =>
  keywordFieldLocalizations(home)[0];

export function readerRole(
  country: string,
  localization: string,
): LocalizationReadRole | null {
  const position = keywordFieldLocalizations(country).findIndex(
    (tag) => tag === localization,
  );
  if (position < 0) return null;
  return position === 0 ? 'default' : 'additional';
}

export const readsKeywordField = (
  country: string,
  localization: string,
): boolean => readerRole(country, localization) !== null;

export const readersOf = (
  localization: string,
  markets: readonly string[],
  home: string,
): LocalizationReader[] =>
  markets.flatMap((country) => {
    const role = readerRole(country, localization);
    return role === null ? [] : [{ country, role, home: country === home }];
  });

export const appMarkets = (
  home: string,
  countries: readonly string[],
): string[] => [
  home,
  ...[...new Set(countries)].filter((country) => country !== home).sort(),
];

const refusalFor = (
  localization: AppStoreLocalization,
  country: string,
  markets: readonly string[],
): string | null => {
  const code = country.toUpperCase();
  if (!markets.includes(country)) {
    return `${code} is not one of this app's markets`;
  }
  return readsKeywordField(country, localization)
    ? null
    : `The ${code} storefront does not read ${APP_STORE_LOCALIZATIONS[localization]}`;
};

export function trackInError(
  localization: AppStoreLocalization,
  trackIn: readonly string[],
  markets: readonly string[],
): string | null {
  for (const country of trackIn) {
    const refusal = refusalFor(localization, country, markets);
    if (refusal !== null) {
      return refusal;
    }
  }
  return null;
}
