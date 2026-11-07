import { Store } from '@prisma/client';
import {
  latestListingTexts,
  latestLocalizedTexts,
  LocalizedTexts,
  relevanceText,
} from '../apps/listing-texts';
import { judgeKeywordCoverage } from '../metadata/keyword-coverage-judge';
import { fieldPhrases } from '../metadata/listing-surfaces';
import { PrismaService } from '../prisma/prisma.service';
import { keywordClassifier, loadBrandProfile } from './keyword-brand-profile';
import { indexKeywordFields, storedKeywordFields } from './keyword-field-index';
import { keywordMarker } from './keyword-marks';
import { AppFacts } from './keywords.mapper';
import { KeywordApp } from './keywords.support';

const marketTitlesOf = (
  listings: ReadonlyMap<string, { title: string }>,
  localized: ReadonlyMap<string, readonly LocalizedTexts[]>,
): Map<string, string[]> =>
  new Map(
    [...listings].map(([market, listing]) => [
      market,
      [
        listing.title,
        ...(localized.get(market) ?? []).map(({ texts }) => texts.title),
      ],
    ]),
  );

export async function listingFacts(
  prisma: PrismaService,
  app: Pick<KeywordApp, 'id' | 'country' | 'store'>,
  markets: readonly string[] = [],
  options: { coverage?: boolean; marks?: boolean; brand?: boolean } = {},
): Promise<AppFacts> {
  const [listings, stored, profile] = await Promise.all([
    latestListingTexts(prisma, app.id, app.country, [app.country, ...markets]),
    storedKeywordFields(prisma, app.id),
    options.brand ? loadBrandProfile(prisma, app) : null,
  ]);
  const home = listings.get(app.country);
  const marketTexts = new Map(
    [...listings]
      .filter(([market]) => market !== app.country)
      .map(([market, listing]) => [market, relevanceText(listing)]),
  );
  const snapshotText = home ? relevanceText(home) : '';
  const localized =
    app.store === Store.APP_STORE &&
    (options.coverage || options.marks || options.brand)
      ? await latestLocalizedTexts(prisma, app.id, app.country, [
          ...listings.keys(),
        ])
      : new Map<string, LocalizedTexts[]>();
  const facts: AppFacts = {
    snapshotText,
    marketTexts,
    inKeywordField: indexKeywordFields(stored),
    ...(profile
      ? {
          classOf: keywordClassifier(profile, {
            snapshotText,
            marketTexts,
            marketTitles: marketTitlesOf(listings, localized),
          }),
        }
      : {}),
  };
  if (!options.coverage && !options.marks) {
    return facts;
  }
  const sources = { listings, localized, keywordFields: fieldPhrases(stored) };
  return {
    ...facts,
    ...(options.coverage
      ? {
          uncovered: (keyword) =>
            judgeKeywordCoverage(app, keyword, sources).uncovered,
        }
      : {}),
    ...(options.marks ? { marks: keywordMarker(app, sources) } : {}),
  };
}
