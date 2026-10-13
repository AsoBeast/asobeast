import { Injectable } from '@nestjs/common';
import { Store } from '@prisma/client';
import {
  declaredLanguage,
  MarketDailyRequests,
  MarketSuggestionsResult,
  nativeLocalizations,
  storefrontsForLanguages,
} from '@asobeast/shared';
import { requestsPerJob } from '../jobs/request-weights';
import { loadAppMarkets } from '../keywords/app-markets';
import { ensureApp } from '../keywords/keywords.support';
import { PrismaService } from '../prisma/prisma.service';
import { extractRawFacts } from '../store-providers/raw-facts';
import { HOME_LISTING, NEWEST_FIRST } from './listing';

const localizedReads = (store: Store, country: string): number =>
  store === Store.APP_STORE ? nativeLocalizations(country).length : 0;

export const marketDailyRequests = (
  store: Store,
  country: string,
  family: number,
): MarketDailyRequests => ({
  listing:
    family *
    (1 + localizedReads(store, country)) *
    requestsPerJob(store, 'apps'),
  perKeyword: requestsPerJob(store, 'keywords'),
});

@Injectable()
export class MarketSuggestionsService {
  constructor(private readonly prisma: PrismaService) {}

  async suggest(appId: string): Promise<MarketSuggestionsResult> {
    const app = await ensureApp(this.prisma, appId);
    if (app.store !== Store.APP_STORE) {
      return { home: app.country, languages: [], suggestions: [] };
    }
    const [latest, markets, family] = await Promise.all([
      this.prisma.appSnapshot.findFirst({
        where: { appId, ...HOME_LISTING },
        orderBy: NEWEST_FIRST,
        select: { raw: true },
      }),
      loadAppMarkets(this.prisma, app),
      this.prisma.app.count({
        where: { OR: [{ id: appId }, { primaryAppId: appId }] },
      }),
    ]);
    const languages = [
      ...new Set(
        extractRawFacts(app.store, latest?.raw).languages.map(declaredLanguage),
      ),
    ];
    const tracked = new Set(markets);
    return {
      home: app.country,
      languages,
      suggestions: storefrontsForLanguages(languages)
        .filter((entry) => entry.country !== app.country)
        .map((entry) => ({
          ...entry,
          tracked: tracked.has(entry.country),
          dailyRequests: marketDailyRequests(app.store, entry.country, family),
        })),
    };
  }
}
