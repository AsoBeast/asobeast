import { KeywordSource, Store } from '@prisma/client';
import { MARKET_SEED_LIMIT } from '@asobeast/shared';
import { Candidate, extractCandidates } from './extraction';
import { interleaveDistinct } from './interleave';
import { ListingText } from './listing-texts';

export const seedSources = (store: Store): readonly KeywordSource[] =>
  store === Store.GOOGLE_PLAY
    ? ['TITLE', 'DESCRIPTION']
    : ['TITLE', 'SUBTITLE'];

export function seedCandidates(
  store: Store,
  listings: readonly ListingText[],
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
      ).filter((candidate) => sources.includes(candidate.source)),
    ),
    MARKET_SEED_LIMIT,
    (candidate) => candidate.text,
  );
}
