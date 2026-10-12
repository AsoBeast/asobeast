import { BadRequestException } from '@nestjs/common';
import { Store } from '@prisma/client';
import {
  APP_STORE_LOCALIZATIONS,
  type AppStoreLocalization,
  assertStorefront,
  KeywordFieldQuery,
  readLocalizations,
} from '@asobeast/shared';

export interface KeywordFieldTarget {
  country: string;
  localization: AppStoreLocalization;
}

const describeLocalization = (
  localization: AppStoreLocalization | undefined,
) =>
  localization === undefined
    ? 'any localization'
    : APP_STORE_LOCALIZATIONS[localization];

export function keywordFieldTarget(
  app: { store: Store; country: string },
  query: KeywordFieldQuery,
): KeywordFieldTarget {
  const country = query.country ?? app.country;
  assertStorefront(app.store, country);
  const read = readLocalizations(country);
  const localization = query.localization ?? read[0];
  if (localization === undefined || !read.includes(localization)) {
    throw new BadRequestException(
      `The ${country.toUpperCase()} storefront reads ${read
        .map((tag) => APP_STORE_LOCALIZATIONS[tag])
        .join(', ')}, not ${describeLocalization(localization)}`,
    );
  }
  return { country, localization };
}
