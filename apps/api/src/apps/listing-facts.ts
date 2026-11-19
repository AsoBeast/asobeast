import { AppSnapshot, Store } from '@prisma/client';
import { AppSnapshotSummary } from '@asobeast/shared';
import {
  contentRatingOf,
  developerId,
  primaryGenreKey,
  primaryGenreName,
  storeDeveloperNameOf,
} from '../store-providers/raw-facts';

export type ListingFacts = Required<
  Pick<
    AppSnapshotSummary,
    | 'genre'
    | 'genreName'
    | 'developer'
    | 'developerId'
    | 'contentRating'
    | 'releasedAt'
    | 'storeUpdatedAt'
  >
>;

const isoOrNull = (date: Date | null): string | null =>
  date instanceof Date && !Number.isNaN(date.getTime())
    ? date.toISOString()
    : null;

export function listingFactsOf(
  store: Store,
  snapshot: Pick<AppSnapshot, 'raw' | 'releasedAt' | 'storeUpdatedAt'>,
): ListingFacts {
  return {
    genre: primaryGenreKey(store, snapshot.raw),
    genreName: primaryGenreName(store, snapshot.raw),
    developer: storeDeveloperNameOf(snapshot.raw),
    developerId: developerId(store, snapshot.raw),
    contentRating: contentRatingOf(snapshot.raw),
    releasedAt: isoOrNull(snapshot.releasedAt),
    storeUpdatedAt: isoOrNull(snapshot.storeUpdatedAt),
  };
}
