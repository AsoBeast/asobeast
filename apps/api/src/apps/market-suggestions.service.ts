import { Injectable, NotFoundException } from '@nestjs/common';
import { Store } from '@prisma/client';
import {
  declaredLanguage,
  MarketSuggestionsResult,
  storefrontsForLanguages,
} from '@asobeast/shared';
import { loadAppMarkets } from '../keywords/app-markets';
import { PrismaService } from '../prisma/prisma.service';
import { extractRawFacts } from '../store-providers/raw-facts';
import { HOME_LISTING, NEWEST_FIRST } from './listing';
import { marketDailyRequests } from './market-cost';
import { shippedLocalizations } from './shipped-localizations';

@Injectable()
export class MarketSuggestionsService {
  constructor(private readonly prisma: PrismaService) {}

  async suggest(appId: string): Promise<MarketSuggestionsResult> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId },
      select: { id: true, store: true, country: true, isCompetitor: true },
    });
    if (!app) {
      throw new NotFoundException(`App ${appId} not found`);
    }
    if (app.store !== Store.APP_STORE || app.isCompetitor) {
      return { home: app.country, languages: [], suggestions: [] };
    }
    const [latest, markets, family, shipped] = await Promise.all([
      this.prisma.appSnapshot.findFirst({
        where: { appId, ...HOME_LISTING },
        orderBy: NEWEST_FIRST,
        select: { raw: true },
      }),
      loadAppMarkets(this.prisma, app),
      this.prisma.app.count({
        where: { OR: [{ id: appId }, { primaryAppId: appId }] },
      }),
      shippedLocalizations(this.prisma, appId),
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
          dailyRequests: marketDailyRequests(
            app.store,
            entry.country,
            family,
            shipped,
          ),
        })),
    };
  }
}
