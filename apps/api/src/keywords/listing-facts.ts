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
import { indexKeywordFields, storedKeywordFields } from './keyword-field-index';
import { keywordMarker } from './keyword-marks';
import { AppFacts } from './keywords.mapper';
import { KeywordApp } from './keywords.support';

export async function listingFacts(
  prisma: PrismaService,
  app: Pick<KeywordApp, 'id' | 'country' | 'store'>,
  markets: readonly string[] = [],
  options: { coverage?: boolean; marks?: boolean } = {},
): Promise<AppFacts> {
  const [listings, stored] = await Promise.all([
    latestListingTexts(prisma, app.id, app.country, [app.country, ...markets]),
    storedKeywordFields(prisma, app.id),
  ]);
  const home = listings.get(app.country);
  const marketTexts = new Map(
    [...listings]
      .filter(([market]) => market !== app.country)
      .map(([market, listing]) => [market, relevanceText(listing)]),
  );
  const facts: AppFacts = {
    snapshotText: home ? relevanceText(home) : '',
    marketTexts,
    inKeywordField: indexKeywordFields(stored),
  };
  if (!options.coverage && !options.marks) {
    return facts;
  }
  const localized =
    app.store === Store.APP_STORE
      ? await latestLocalizedTexts(prisma, app.id, app.country, [
          ...listings.keys(),
        ])
      : new Map<string, LocalizedTexts[]>();
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
