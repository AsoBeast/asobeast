import { Injectable, NotFoundException } from '@nestjs/common';
import { Store } from '@prisma/client';
import {
  assertStorefront,
  CompetitorKeywordIdeas,
  normalizeText,
} from '@asobeast/shared';
import { HOME_LISTING, listingIn, NEWEST_FIRST } from '../apps/listing';
import { trackedTexts } from '../keywords/keywords.support';
import { listingLanguages } from '../keywords/listing-languages';
import { PrismaService } from '../prisma/prisma.service';
import { POPULARITY_MAX_AGE_DAYS } from '../scoring/official-popularity';
import { ProxyEgress } from '../store-providers/egress/proxy-egress.service';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { KeywordIdeasQueryDto } from './dto/keyword-ideas-query.dto';
import {
  IdeaHint,
  IdeaListing,
  ideaSeeds,
  ideaSources,
  keywordIdeas,
} from './keyword-ideas';

const DAY_MS = 24 * 60 * 60 * 1000;

interface OfficialPopularity {
  week: string | null;
  byTerm: Map<string, number>;
}

@Injectable()
export class KeywordIdeasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: StoreProviderRegistry,
    private readonly egress: ProxyEgress,
  ) {}

  async ideas(
    appId: string,
    query: KeywordIdeasQueryDto,
  ): Promise<CompetitorKeywordIdeas> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId },
      select: { store: true, country: true },
    });
    if (!app) {
      throw new NotFoundException(`App ${appId} not found`);
    }
    const country = query.country ?? app.country;
    assertStorefront(app.store, country);

    const [listings, excluded] = await Promise.all([
      this.competitorListings(appId, country),
      trackedTexts(this.prisma, appId, country),
    ]);
    const sources = ideaSources(listings, listingLanguages(app.store, country));
    const seeds = ideaSeeds(sources);
    const hints = await this.egress.through(app.store, country, () =>
      this.hints(app.store, country, seeds),
    );
    const official = await this.officialPopularity(
      app.store,
      country,
      hints.map((hint) => normalizeText(hint.term)),
    );

    return {
      country,
      seeds,
      popularityWeek: official.week,
      ideas: keywordIdeas({
        sources,
        hints,
        popularity: official.byTerm,
        excluded,
        limit: query.limit,
      }),
    };
  }

  private async hints(
    store: Store,
    country: string,
    seeds: readonly string[],
  ): Promise<IdeaHint[]> {
    const provider = this.registry.get(store);
    const hints: IdeaHint[] = [];
    for (const seed of seeds) {
      const items = await provider.suggest(seed, country);
      items.forEach((item, index) => {
        hints.push({ seed, position: index + 1, term: item.term });
      });
    }
    return hints;
  }

  private async officialPopularity(
    store: Store,
    country: string,
    terms: readonly string[],
  ): Promise<OfficialPopularity> {
    if (store !== Store.APP_STORE || terms.length === 0) {
      return { week: null, byTerm: new Map() };
    }
    const latest = await this.prisma.searchTermPopularity.findFirst({
      where: {
        country,
        week: { gte: new Date(Date.now() - POPULARITY_MAX_AGE_DAYS * DAY_MS) },
      },
      orderBy: { week: 'desc' },
      select: { week: true },
    });
    if (!latest) {
      return { week: null, byTerm: new Map() };
    }
    const rows = await this.prisma.searchTermPopularity.groupBy({
      by: ['term'],
      where: { country, week: latest.week, term: { in: [...terms] } },
      _max: { popularity: true },
    });
    return {
      week: latest.week.toISOString().slice(0, 10),
      byTerm: new Map(
        rows.flatMap((row) =>
          row._max.popularity === null
            ? []
            : [[row.term, row._max.popularity] as const],
        ),
      ),
    };
  }

  private async competitorListings(
    appId: string,
    market: string,
  ): Promise<IdeaListing[]> {
    const competitors = await this.prisma.app.findMany({
      where: { primaryAppId: appId },
      select: { id: true, name: true, country: true },
      orderBy: { createdAt: 'asc' },
    });
    const listings = await Promise.all(
      competitors.map(async (competitor) => {
        const select = { title: true, subtitle: true } as const;
        const listing =
          (await this.prisma.appSnapshot.findFirst({
            where: {
              appId: competitor.id,
              ...listingIn(competitor.country, market),
            },
            orderBy: NEWEST_FIRST,
            select,
          })) ??
          (await this.prisma.appSnapshot.findFirst({
            where: { appId: competitor.id, ...HOME_LISTING },
            orderBy: NEWEST_FIRST,
            select,
          }));
        return listing
          ? [{ appId: competitor.id, name: competitor.name, ...listing }]
          : [];
      }),
    );
    return listings.flat();
  }
}
