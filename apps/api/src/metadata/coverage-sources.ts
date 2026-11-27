import { Store } from '@prisma/client';
import { AppStoreLocalization } from '@asobeast/shared';
import {
  latestListingTexts,
  latestLocalizedTexts,
  ListingTexts,
  LocalizedTexts,
} from '../apps/listing-texts';
import { storedLocalization } from '../apps/listing';
import { storedKeywordFields } from '../keywords/keyword-field-index';
import { PrismaService } from '../prisma/prisma.service';
import { CoverageSources } from './keyword-coverage-judge';
import { fieldPhrases } from './listing-surfaces';

export interface CoverageApp {
  id: string;
  store: Store;
  country: string;
}

export interface ListingView {
  market: string;
  localization: AppStoreLocalization | null;
}

export interface LoadedCoverage {
  sources: CoverageSources;
  view: ListingTexts | undefined;
}

export async function loadCoverageSources(
  prisma: PrismaService,
  app: CoverageApp,
  countries: readonly string[],
  view: ListingView,
): Promise<LoadedCoverage> {
  const [listings, stored] = await Promise.all([
    latestListingTexts(prisma, app.id, app.country, [
      app.country,
      view.market,
      ...countries,
    ]),
    storedKeywordFields(prisma, app.id),
  ]);
  const localized =
    app.store === Store.APP_STORE
      ? await latestLocalizedTexts(prisma, app.id, app.country, [
          ...listings.keys(),
        ])
      : new Map<string, LocalizedTexts[]>();
  const localization = storedLocalization(
    app.store,
    view.market,
    view.localization,
  );
  return {
    sources: { listings, localized, keywordFields: fieldPhrases(stored) },
    view:
      localization === null
        ? listings.get(view.market)
        : localized
            .get(view.market)
            ?.find((entry) => entry.localization === localization)?.texts,
  };
}
