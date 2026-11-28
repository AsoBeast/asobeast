import { BadRequestException } from '@nestjs/common';
import { Store } from '@prisma/client';
import {
  APP_STORE_LOCALIZATIONS,
  type AppStoreLocalization,
  assertStorefront,
  type DefaultingListing,
  defaultLocalizationIn,
  KeywordFieldQuery,
} from '@asobeast/shared';
import { readsKeywordField, storefrontReads } from './localization-markets';

export interface KeywordFieldTarget {
  country: string;
  localization: AppStoreLocalization;
}

export function keywordFieldTarget(
  app: DefaultingListing & { store: Store },
  query: KeywordFieldQuery,
): KeywordFieldTarget {
  const country = query.country ?? app.country;
  if (country !== app.country) {
    assertStorefront(app.store, country);
  }
  const localization =
    query.localization ?? defaultLocalizationIn(app, country);
  if (!readsKeywordField(app, country, localization)) {
    throw new BadRequestException(
      `The ${country.toUpperCase()} storefront reads ${storefrontReads(
        app,
        country,
      )
        .map((read) => APP_STORE_LOCALIZATIONS[read.localization])
        .join(', ')}, not ${APP_STORE_LOCALIZATIONS[localization]}`,
    );
  }
  return { country, localization };
}
