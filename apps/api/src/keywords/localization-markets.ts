import {
  type AppStoreLocalization,
  keywordFieldLocalizations,
} from '@asobeast/shared';

export const homeLocalization = (home: string): AppStoreLocalization =>
  keywordFieldLocalizations(home)[0];

export const readsKeywordField = (
  country: string,
  localization: string,
): boolean =>
  keywordFieldLocalizations(country).some((tag) => tag === localization);

export const appMarkets = (
  home: string,
  countries: readonly string[],
): string[] => [
  home,
  ...[...new Set(countries)].filter((country) => country !== home).sort(),
];
