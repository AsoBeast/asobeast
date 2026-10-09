import { Store } from '@prisma/client';
import { extractRawFacts } from './raw-facts';

interface SubtitledListing {
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
