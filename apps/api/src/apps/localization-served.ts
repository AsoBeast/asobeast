import { Store } from '@prisma/client';
import { screenshotKeys } from '../changes/screenshot-diff';
import { ownSubtitle } from '../store-providers/own-subtitle';
import { releaseNotesFor } from '../store-providers/raw-facts';

export interface ComparableListing {
  title: string;
  subtitle?: string | null;
  subtitleUnavailable?: boolean;
  description: string;
  raw: unknown;
}

const textSignature = (store: Store, listing: ComparableListing): string =>
  JSON.stringify([
    listing.title,
    listing.description,
    releaseNotesFor(store, listing.raw),
    (screenshotKeys(store, listing.raw) ?? []).map((shot) => shot.key),
  ]);

const hasOwnSubtitleOf = (
  store: Store,
  fallback: ComparableListing,
  localized: ComparableListing,
): boolean => {
  const subtitle = ownSubtitle(store, localized);
  return subtitle !== null && subtitle !== ownSubtitle(store, fallback);
};

const subtitleWasRead = (fallback: ComparableListing): boolean =>
  (fallback.subtitle ?? null) !== null ||
  fallback.subtitleUnavailable === false;

export function servesLocalization(
  store: Store,
  fallback: ComparableListing,
  localized: ComparableListing,
): boolean {
  return (
    textSignature(store, fallback) !== textSignature(store, localized) ||
    (subtitleWasRead(fallback) && hasOwnSubtitleOf(store, fallback, localized))
  );
}
