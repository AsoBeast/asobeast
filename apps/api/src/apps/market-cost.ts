import { Store } from '@prisma/client';
import {
  KeywordImportCost,
  MarketDailyRequests,
  nativeLocalizations,
} from '@asobeast/shared';
import { requestsPerJob } from '../jobs/request-weights';
import { capturedLocalizations } from './market-localizations';

export function marketDailyRequests(
  store: Store,
  country: string,
  family: number,
  shipped: readonly string[] = [],
): MarketDailyRequests {
  const appStore = store === Store.APP_STORE;
  const native = appStore ? nativeLocalizations(country).length : 0;
  const own = appStore ? capturedLocalizations(country, shipped).length : 0;
  return {
    listing:
      (family * (1 + native) + own - native) * requestsPerJob(store, 'apps'),
    perKeyword: requestsPerJob(store, 'keywords'),
  };
}

export const seedCost = (
  store: Store,
  { opened, listingReads }: { opened: number; listingReads: number },
): KeywordImportCost => ({
  store,
  keywordMarkets: opened,
  dailyRequests: opened * requestsPerJob(store, 'keywords') + listingReads,
});
