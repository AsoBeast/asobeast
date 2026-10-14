import { BadRequestException } from '@nestjs/common';
import { Store } from '@prisma/client';
import {
  APP_STORE_LOCALIZATIONS,
  type AppStoreLocalization,
  assertStorefront,
  KeywordFieldQuery,
  keywordFieldLocalizations,
} from '@asobeast/shared';

export interface KeywordFieldTarget {
  country: string;
  localization: AppStoreLocalization;
}

export function keywordFieldTarget(
  app: { store: Store; country: string },
  query: KeywordFieldQuery,
): KeywordFieldTarget {
  const country = query.country ?? app.country;
  if (country !== app.country) {
    assertStorefront(app.store, country);
  }
  const read = keywordFieldLocalizations(country);
  const localization = query.localization ?? read[0];
  if (!read.includes(localization)) {
    throw new BadRequestException(
      `The ${country.toUpperCase()} storefront reads ${read
        .map((tag) => APP_STORE_LOCALIZATIONS[tag])
        .join(', ')}, not ${APP_STORE_LOCALIZATIONS[localization]}`,
    );
  }
  return { country, localization };
}
