import { Store } from '@prisma/client';
import { screenshotKeys } from '../changes/screenshot-diff';
import { extractRawFacts, releaseNotesFor } from '../store-providers/raw-facts';

export interface ComparableListing {
  title: string;
  subtitle?: string | null;
  description: string;
  raw: unknown;
}

const ownSubtitle = (
  store: Store,
  listing: ComparableListing,
): string | null => {
  const subtitle = listing.subtitle ?? null;
  return subtitle === extractRawFacts(store, listing.raw).genres[0]
    ? null
    : subtitle;
};

const signature = (store: Store, listing: ComparableListing): string =>
  JSON.stringify([
    listing.title,
    ownSubtitle(store, listing),
    listing.description,
    releaseNotesFor(store, listing.raw),
    (screenshotKeys(store, listing.raw) ?? []).map((shot) => shot.key),
  ]);

export function servesLocalization(
  store: Store,
  fallback: ComparableListing,
  localized: ComparableListing,
): boolean {
  return signature(store, fallback) !== signature(store, localized);
}
