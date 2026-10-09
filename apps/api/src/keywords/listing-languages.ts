import { Store } from '@prisma/client';
import { marketLanguages, storefrontLanguage } from '@asobeast/shared';

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
