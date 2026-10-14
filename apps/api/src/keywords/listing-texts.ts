import { Store } from '@prisma/client';
import {
  AppStoreLocalization,
  localizationLanguage,
  nativeLocalizations,
} from '@asobeast/shared';
import { listingIn, NEWEST_FIRST } from '../apps/listing';
import { PrismaService } from '../prisma/prisma.service';
import { listingLanguages } from './listing-languages';

export interface ListingText {
  title: string;
  subtitle: string | null;
  summary: string | null;
  languages: readonly string[];
}

interface ListedApp {
  id: string;
  store: Store;
  country: string;
}

const latestListing = (
  prisma: PrismaService,
  app: ListedApp,
  market: string,
  localization: string | null,
) =>
  prisma.appSnapshot.findFirst({
    where: {
      appId: app.id,
      ...listingIn(app.country, market, localization),
    },
    orderBy: NEWEST_FIRST,
    select: { title: true, subtitle: true, summary: true },
  });

export async function listingTexts(
  prisma: PrismaService,
  app: ListedApp,
  market: string = app.country,
  read: readonly AppStoreLocalization[] = nativeLocalizations(market),
): Promise<ListingText[]> {
  const localizations = app.store === Store.APP_STORE ? read : [];
  const rows = await Promise.all(
    [...localizations, null].map((localization) =>
      latestListing(prisma, app, market, localization),
    ),
  );
  const localized = localizations.flatMap((localization, index) => {
    const row = rows[index];
    return row
      ? [{ ...row, languages: [localizationLanguage(localization)] }]
      : [];
  });
  const fallback = rows[localizations.length];
  if (!fallback) {
    return localized;
  }
  const ownLanguages = new Set(localized.flatMap((row) => row.languages));
  const languages = listingLanguages(app.store, market).filter(
    (language) => !ownLanguages.has(language),
  );
  return [...localized, { ...fallback, languages }];
}
