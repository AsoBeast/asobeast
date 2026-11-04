import { Store } from '@prisma/client';
import { CoverageFieldStatus } from '@asobeast/shared';
import { ListingTexts, LocalizedTexts } from '../apps/listing-texts';
import {
  FieldPhrases,
  JudgingSurfaces,
  judgingSurfaces,
} from './listing-surfaces';
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

export interface KeywordSurfaces extends JudgingSurfaces {
  listingCountry: string;
}

export function keywordSurfaces(
  app: { store: Store; country: string },
  country: string,
  sources: CoverageSources,
): KeywordSurfaces {
  const listingCountry = sources.listings.has(country) ? country : app.country;
  return {
    listingCountry,
    ...judgingSurfaces(
      {
        store: app.store,
        country: listingCountry,
        home: listingCountry === app.country,
        listing: sources.listings.get(listingCountry),
        captured: sources.localized.get(listingCountry) ?? [],
      },
      sources.keywordFields,
    ),
  };
}

export function judgeKeywordCoverage(
  app: { store: Store; country: string },
  keyword: { text: string; country: string },
  sources: CoverageSources,
): KeywordCoverage {
  const { listingCountry, surfaces, localized } = keywordSurfaces(
    app,
    keyword.country,
    sources,
  );
  const fields = judgeFields(keyword.text, surfaces, localized);
  return {
    fields,
    listingCountry,
    uncovered: fields.every((field) => !field.covered),
  };
}
