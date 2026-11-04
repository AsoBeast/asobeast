import { Store } from '@prisma/client';
import { CoverageFieldStatus } from '@asobeast/shared';
import { ListingTexts, LocalizedTexts } from '../apps/listing-texts';
import { FieldPhrases, judgingSurfaces } from './listing-surfaces';
import { judgeFields } from './localized-coverage';

export interface CoverageSources {
  listings: ReadonlyMap<string, ListingTexts>;
  localized: ReadonlyMap<string, readonly LocalizedTexts[]>;
  keywordFields: FieldPhrases;
}

export interface KeywordCoverage {
  fields: CoverageFieldStatus[];
  listingCountry: string;
  uncovered: boolean;
}

export function judgeKeywordCoverage(
  app: { store: Store; country: string },
  keyword: { text: string; country: string },
  sources: CoverageSources,
): KeywordCoverage {
  const listingCountry = sources.listings.has(keyword.country)
    ? keyword.country
    : app.country;
  const { surfaces, localized } = judgingSurfaces(
    {
      store: app.store,
      country: listingCountry,
      home: listingCountry === app.country,
      listing: sources.listings.get(listingCountry),
      captured: sources.localized.get(listingCountry) ?? [],
    },
    sources.keywordFields,
  );
  const fields = judgeFields(keyword.text, surfaces, localized);
  return {
    fields,
    listingCountry,
    uncovered: fields.every((field) => !field.covered),
  };
}
