import { Store } from '@prisma/client';
import {
  AppStoreLocalization,
  nativeLocalizations,
  readLocalizations,
} from '@asobeast/shared';
import { extractRawFacts } from '../store-providers/raw-facts';
import { suspectedHomeDefault } from './home-default';
import { ComparableListing } from './localization-served';

export interface ProbingApp {
  store: Store;
  country: string;
  isCompetitor: boolean;
}

export function capturedLocalizations(
  market: string,
  shipped: readonly string[],
): AppStoreLocalization[] {
  const captured = new Set<string>([
    ...nativeLocalizations(market),
    ...shipped,
  ]);
  return readLocalizations(market)
    .slice(1)
    .filter((localization) => captured.has(localization));
}

export function homeDefaultProbes(
  app: ProbingApp,
  market: string,
  listing: Pick<ComparableListing, 'description' | 'raw'>,
): AppStoreLocalization[] {
  if (
    market !== app.country ||
    app.isCompetitor ||
    app.store !== Store.APP_STORE
  ) {
    return [];
  }
  const suspect = suspectedHomeDefault({
    home: market,
    description: listing.description,
    declared: extractRawFacts(app.store, listing.raw).languages,
  });
  return suspect === null ? [] : [suspect];
}
