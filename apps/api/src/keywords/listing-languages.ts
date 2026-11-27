import { Store } from '@prisma/client';
import {
  defaultLocalizationIn,
  type DefaultingListing,
  keywordFieldLocalizations,
  localizationLanguage,
  marketLanguages,
  storefrontLanguage,
} from '@asobeast/shared';

export function listingLanguages(
  store: Store,
  country: string,
): readonly string[] {
  if (store === Store.APP_STORE) {
    return marketLanguages(country);
  }
  const language = storefrontLanguage(country);
  return language === null || language === 'en' ? [] : [language];
}

export function defaultListingLanguages(
  app: DefaultingListing & { store: Store },
  market: string = app.country,
): readonly string[] {
  if (app.store !== Store.APP_STORE) {
    return listingLanguages(app.store, market);
  }
  const tag = defaultLocalizationIn(app, market);
  return tag === keywordFieldLocalizations(market)[0]
    ? listingLanguages(app.store, market)
    : [localizationLanguage(tag)];
}
