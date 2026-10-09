import { Store } from '@prisma/client';
import { extractRawFacts } from './raw-facts';

export interface SubtitledListing {
  subtitle?: string | null;
  raw: unknown;
}

export function ownSubtitle(
  store: Store,
  listing: SubtitledListing,
): string | null {
  const subtitle = listing.subtitle ?? null;
  return subtitle === extractRawFacts(store, listing.raw).genres[0]
    ? null
    : subtitle;
}

export function withOwnSubtitle<T extends { subtitle: string | null }>(
  store: Store,
  listing: T & SubtitledListing,
): T {
  return { ...listing, subtitle: ownSubtitle(store, listing) };
}
