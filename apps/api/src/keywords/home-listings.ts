import { Store } from '@prisma/client';
import { localizationLanguage, nativeLocalizations } from '@asobeast/shared';
import { listingIn, NEWEST_FIRST } from '../apps/listing';
import { PrismaService } from '../prisma/prisma.service';
import { listingLanguages } from './listing-languages';

export interface HomeListingText {
  title: string;
  subtitle: string | null;
  summary: string | null;
  languages: readonly string[];
}

interface HomeApp {
  id: string;
  store: Store;
  country: string;
}

const latestListing = (
  prisma: PrismaService,
  app: HomeApp,
  localization: string | null,
) =>
  prisma.appSnapshot.findFirst({
    where: {
      appId: app.id,
      ...listingIn(app.country, app.country, localization),
    },
    orderBy: NEWEST_FIRST,
    select: { title: true, subtitle: true, summary: true },
  });

export async function homeListingTexts(
  prisma: PrismaService,
  app: HomeApp,
): Promise<HomeListingText[]> {
  const localizations =
    app.store === Store.APP_STORE ? nativeLocalizations(app.country) : [];
  const rows = await Promise.all(
    [...localizations, null].map((localization) =>
      latestListing(prisma, app, localization),
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
  const languages = listingLanguages(app.store, app.country).filter(
    (language) => !ownLanguages.has(language),
  );
  return [...localized, { ...fallback, languages }];
}
