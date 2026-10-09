import { Store } from '@prisma/client';
import { screenshotKeys } from '../changes/screenshot-diff';
import { ownSubtitle } from '../store-providers/own-subtitle';
import { releaseNotesFor } from '../store-providers/raw-facts';

export interface ComparableListing {
  title: string;
  subtitle?: string | null;
  description: string;
  raw: unknown;
}

const signature = (
  store: Store,
  listing: ComparableListing,
  withSubtitle: boolean,
): string =>
  JSON.stringify([
    listing.title,
    withSubtitle ? ownSubtitle(store, listing) : null,
    listing.description,
    releaseNotesFor(store, listing.raw),
    (screenshotKeys(store, listing.raw) ?? []).map((shot) => shot.key),
  ]);

export function servesLocalization(
  store: Store,
  fallback: ComparableListing,
  localized: ComparableListing,
): boolean {
  const withSubtitle = (fallback.subtitle ?? null) !== null;
  return (
    signature(store, fallback, withSubtitle) !==
    signature(store, localized, withSubtitle)
  );
}
