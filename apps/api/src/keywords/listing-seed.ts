import { KeywordSource, Store } from '@prisma/client';
import { MARKET_SEED_LIMIT } from '@asobeast/shared';
import {
  Candidate,
  CandidateSource,
  CandidateTest,
  extractCandidates,
} from './extraction';
import { interleaveDistinct } from './interleave';
import { fieldCoverage } from './keyword-coverage';
import { ListingText } from './listing-texts';

export const seedSources = (store: Store): readonly KeywordSource[] =>
  store === Store.GOOGLE_PLAY
    ? ['TITLE', 'DESCRIPTION']
    : ['TITLE', 'SUBTITLE'];

function seededFieldHolds(
  listing: ListingText,
  sources: readonly KeywordSource[],
): CandidateTest {
  const fields: Record<CandidateSource, (keyword: string) => boolean> = {
    TITLE: fieldCoverage(listing.title),
    SUBTITLE: fieldCoverage(listing.subtitle ?? ''),
    DESCRIPTION: fieldCoverage(listing.summary ?? ''),
  };
  return (text, source) => sources.includes(source) && fields[source](text);
}

export function seedCandidates(
  store: Store,
  listings: readonly ListingText[],
  limit = MARKET_SEED_LIMIT,
): Candidate[] {
  const sources = seedSources(store);
  return interleaveDistinct(
    listings.map((listing) =>
      extractCandidates(
        {
          title: listing.title,
          subtitle: listing.subtitle ?? undefined,
          summary: listing.summary ?? undefined,
        },
        listing.languages,
        seededFieldHolds(listing, sources),
      ),
    ),
    limit,
    (candidate) => candidate.text,
  );
}
