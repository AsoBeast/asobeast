import { Store } from '@prisma/client';
import {
  type AppStoreLocalization,
  type DefaultingListing,
  isStorefront,
  keywordFieldLocalizations,
} from '@asobeast/shared';
import { homeLocalizationOf } from '../keywords/localization-markets';
import { ComparableListing, servesLocalization } from './localization-served';

export interface DefaultLocalizationProof {
  home: DefaultingListing;
  market: string;
  homeListing: ComparableListing;
  listing: ComparableListing;
  others: readonly ComparableListing[];
}

export function provenDefaultLocalization({
  home,
  market,
  homeListing,
  listing,
  others,
}: DefaultLocalizationProof): AppStoreLocalization | null {
  if (!isStorefront(Store.APP_STORE, market)) return null;
  const localization = keywordFieldLocalizations(market)[0];
  if (localization === homeLocalizationOf(home)) return null;
  if (!servesLocalization(Store.APP_STORE, homeListing, listing)) return null;
  const echoed = others.some(
    (other) => !servesLocalization(Store.APP_STORE, other, listing),
  );
  return echoed ? null : localization;
}
