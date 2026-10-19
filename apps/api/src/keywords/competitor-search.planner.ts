import { Injectable } from '@nestjs/common';
import { KeywordSuggestion } from '@asobeast/shared';
import { HOME_LISTING, listingIn, NEWEST_FIRST } from '../apps/listing';
import { PrismaService } from '../prisma/prisma.service';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import {
  type CompetitorListing,
  competitorSearches,
  competitorSeeds,
} from './competitor-seeds';
import { suggestAround } from './store-hints';
import { StoreLookup, SuggestionRequest } from './suggestion-request';

const LISTING_SELECT = { title: true, subtitle: true, summary: true } as const;

interface Competitor {
  id: string;
  name: string | null;
  country: string;
}

@Injectable()
export class CompetitorSearchPlanner {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: StoreProviderRegistry,
  ) {}

  async plan(request: SuggestionRequest): Promise<StoreLookup | null> {
    const listings = await this.competitorListings(request);
    const seeds = competitorSeeds(listings, request.market.store);
    if (seeds.length === 0) return null;
    const provider = this.registry.get(request.market.store);
    const context = {
      seeds,
      excluded: request.tracked,
      titles: listings.map((listing) => listing.title),
      names: listings.flatMap((listing) =>
        listing.name ? [listing.name] : [],
      ),
      limit: request.limit,
    };
    return async (): Promise<KeywordSuggestion[]> => {
      const hints = await suggestAround(
        provider,
        seeds.map((seed) => seed.text),
        request.market.country,
      );
      return competitorSearches(hints, context).map((search) => ({
        ...search,
        strategy: 'competitorSearch' as const,
      }));
    };
  }

  private async competitorListings(
    request: SuggestionRequest,
  ): Promise<CompetitorListing[]> {
    const competitors = await this.prisma.app.findMany({
      where: { primaryAppId: request.appId },
      select: { id: true, name: true, country: true },
      orderBy: { createdAt: 'asc' },
    });
    const listings = await Promise.all(
      competitors.map((competitor) => this.listingOf(competitor, request)),
    );
    return listings.flatMap((listing) => (listing ? [listing] : []));
  }

  private async listingOf(
    competitor: Competitor,
    { market, languages }: SuggestionRequest,
  ): Promise<CompetitorListing | null> {
    const inMarket = await this.prisma.appSnapshot.findFirst({
      where: {
        appId: competitor.id,
        ...listingIn(competitor.country, market.country),
      },
      orderBy: NEWEST_FIRST,
      select: LISTING_SELECT,
    });
    if (inMarket) return toListing(competitor, inMarket, languages.market);
    if (market.country === competitor.country) return null;
    const home = await this.prisma.appSnapshot.findFirst({
      where: { appId: competitor.id, ...HOME_LISTING },
      orderBy: NEWEST_FIRST,
      select: LISTING_SELECT,
    });
    return home ? toListing(competitor, home, languages.home) : null;
  }
}

function toListing(
  competitor: Competitor,
  texts: { title: string; subtitle: string | null; summary: string | null },
  languages: readonly string[],
): CompetitorListing {
  return {
    appId: competitor.id,
    name: competitor.name,
    title: texts.title,
    subtitle: texts.subtitle,
    summary: texts.summary,
    languages,
  };
}
