import {
  APP_STORE_LOCALIZATIONS,
  type AppStoreLocalization,
  type DefaultingListing,
  defaultLocalizationIn,
  keywordFieldLocalizations,
  type LocalizationReader,
  type LocalizationReadRole,
} from '@asobeast/shared';

export interface StorefrontRead {
  localization: AppStoreLocalization;
  role: LocalizationReadRole;
}

export const homeLocalizationOf = (
  app: DefaultingListing,
): AppStoreLocalization => defaultLocalizationIn(app, app.country);

export function storefrontReads(
  app: DefaultingListing,
  country: string,
): StorefrontRead[] {
  const listed = keywordFieldLocalizations(country).map(
    (localization, index): StorefrontRead => ({
      localization,
      role: index === 0 ? 'default' : 'additional',
    }),
  );
  const own = defaultLocalizationIn(app, country);
  return listed.some((read) => read.localization === own)
    ? listed
    : [{ localization: own, role: 'default' }, ...listed];
}

export const readerRole = (
  app: DefaultingListing,
  country: string,
  localization: string,
): LocalizationReadRole | null =>
  storefrontReads(app, country).find(
    (read) => read.localization === localization,
  )?.role ?? null;

export const readsKeywordField = (
  app: DefaultingListing,
  country: string,
  localization: string,
): boolean => readerRole(app, country, localization) !== null;

export const readersOf = (
  app: DefaultingListing,
  localization: string,
  markets: readonly string[],
): LocalizationReader[] =>
  markets.flatMap((country) => {
    const role = readerRole(app, country, localization);
    return role === null
      ? []
      : [{ country, role, home: country === app.country }];
  });

export const appMarkets = (
  home: string,
  countries: readonly string[],
): string[] => [
  home,
  ...[...new Set(countries)].filter((country) => country !== home).sort(),
];

const refusalFor = (
  app: DefaultingListing,
  localization: AppStoreLocalization,
  country: string,
  markets: readonly string[],
): string | null => {
  const code = country.toUpperCase();
  if (!markets.includes(country)) {
    return `${code} is not one of this app's markets`;
  }
  return readsKeywordField(app, country, localization)
    ? null
    : `The ${code} storefront does not read ${APP_STORE_LOCALIZATIONS[localization]}`;
};

export function trackInError(
  app: DefaultingListing,
  localization: AppStoreLocalization,
  trackIn: readonly string[],
  markets: readonly string[],
): string | null {
  for (const country of trackIn) {
    const refusal = refusalFor(app, localization, country, markets);
    if (refusal !== null) {
      return refusal;
    }
  }
  return null;
}
