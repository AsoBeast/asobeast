import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CompetitorSuggestions } from '@asobeast/shared';
import { Store } from '@prisma/client';
import { RateLimitExceededError } from '../auth/rate-limit/rate-limit.errors';
import { listingTexts } from '../keywords/listing-texts';
import { PrismaService } from '../prisma/prisma.service';
import { ProxyEgress } from '../store-providers/egress/proxy-egress.service';
import { StoreRequestError } from '../store-providers/errors';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { SearchItem } from '../store-providers/types';
import { CompetitorsService } from './competitors.service';
import { mergeSuggestions, withSimilarIcons } from './competitor-suggestions';
import { closestSimilar, listingTerms } from './similar-relevance';

const DISCOVERY_WINDOW_DAYS = 30;

interface PrimaryApp {
  id: string;
  store: Store;
  storeAppId: string;
  country: string;
  competitors: { storeAppId: string }[];
}

@Injectable()
export class CompetitorSuggestionsService {
  private readonly logger = new Logger(CompetitorSuggestionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly competitors: CompetitorsService,
    private readonly registry: StoreProviderRegistry,
    private readonly egress: ProxyEgress,
  ) {}

  async suggest(
    appId: string,
    spend?: () => Promise<void>,
  ): Promise<CompetitorSuggestions> {
    const app = await this.primary(appId);
    const exclude = new Set([
      app.storeAppId,
      ...app.competitors.map((competitor) => competitor.storeAppId),
    ]);
    const serp = await this.competitors.discovery(appId, {
      days: DISCOVERY_WINDOW_DAYS,
    });
    const similar = await this.similarApps(app, spend);
    const shown = new Set([
      ...exclude,
      ...serp.items.map((item) => item.storeAppId),
    ]);
    const unshown = (similar ?? []).filter(
      (item) => !shown.has(item.storeAppId),
    );
    return {
      store: app.store,
      country: app.country,
      similar: similar ? 'ok' : 'unavailable',
      items: mergeSuggestions(
        withSimilarIcons(serp.items, similar ?? []),
        await this.onTopic(app, unshown),
        exclude,
      ),
    };
  }

  private async primary(appId: string): Promise<PrimaryApp> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId, isCompetitor: false },
      select: {
        id: true,
        store: true,
        storeAppId: true,
        country: true,
        competitors: { select: { storeAppId: true } },
      },
    });
    if (!app) {
      throw new NotFoundException(`App ${appId} not found`);
    }
    return app;
  }

  private async onTopic(
    app: PrimaryApp,
    similar: SearchItem[],
  ): Promise<SearchItem[]> {
    if (app.store !== Store.GOOGLE_PLAY) return similar;
    const home = (await listingTexts(this.prisma, app)).at(-1);
    return closestSimilar(home ? listingTerms(home) : [], similar);
  }

  private async similarApps(
    app: PrimaryApp,
    spend?: () => Promise<void>,
  ): Promise<SearchItem[] | null> {
    try {
      await spend?.();
      return await this.egress.through(
        app.store,
        app.country,
        () => this.registry.get(app.store).similar(app.storeAppId, app.country),
        { waitForLocal: false },
      );
    } catch (error) {
      if (
        !(error instanceof StoreRequestError) &&
        !(error instanceof RateLimitExceededError)
      ) {
        throw error;
      }
      this.logger.warn(
        `similar apps of ${app.storeAppId} unavailable: ${error.message}`,
      );
      return null;
    }
  }
}
