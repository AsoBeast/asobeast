import { Store } from '@prisma/client';
import {
  type AppStoreLocalization,
  isStorefront,
  keywordFieldLocalizations,
} from '@asobeast/shared';
import { homeLocalization } from '../keywords/localization-markets';
import { ComparableListing, servesLocalization } from './localization-served';

export interface DefaultLocalizationProof {
  home: string;
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
  if (localization === homeLocalization(home)) return null;
  if (!servesLocalization(Store.APP_STORE, homeListing, listing)) return null;
  const echoed = others.some(
    (other) => !servesLocalization(Store.APP_STORE, other, listing),
  );
  return echoed ? null : localization;
}
