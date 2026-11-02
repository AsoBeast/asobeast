import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AppDetail,
  AppStoreLocalization,
  ListingMarket,
} from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';
import { toAppDetail, toListingMarkets, withTracking } from './apps.mapper';
import { shippedLocalizations } from './shipped-localizations';
import { EVERY_LISTING, latestListingIn, listingIn } from './listing';
import { NewestRating, withRatings } from './market-ratings';
import { missingListing } from './missing-listing';

export type AppWithListings = Prisma.AppGetPayload<{
  include: { competitors: true; group: { include: { apps: true } } };
}>;

@Injectable()
export class ListingReadService {
  constructor(private readonly prisma: PrismaService) {}

  async markets(id: string): Promise<ListingMarket[]> {
    const app = await this.prisma.app.findFirst({
      where: { id },
      select: { country: true, primaryAppId: true },
    });
    if (!app) {
      throw new NotFoundException(`App ${id} not found`);
    }
    const [rows, keywords, shipped] = await Promise.all([
      this.prisma.appSnapshot.groupBy({
        by: ['country', 'localization'],
        where: { appId: id, ...EVERY_LISTING },
        _max: { capturedAt: true },
      }),
      this.prisma.keyword.findMany({
        where: { tracked: { some: { appId: app.primaryAppId ?? id } } },
        select: { country: true },
        distinct: ['country'],
      }),
      shippedLocalizations(this.prisma, { id, country: app.country }),
    ]);
    const listed = withTracking(
      toListingMarkets(app.country, rows, shipped),
      new Set(keywords.map((keyword) => keyword.country)),
    );
    return withRatings(
      listed,
      await this.newestRatings(id, app.country, listed),
      app.country,
    );
  }

  private newestRatings(
    appId: string,
    home: string,
    markets: readonly ListingMarket[],
  ): Promise<NewestRating[]> {
    const captured = markets.flatMap(({ country, capturedAt }) =>
      capturedAt === null
        ? []
        : [{ country, capturedAt: new Date(capturedAt) }],
    );
    return this.prisma.appSnapshot.findMany({
      where: {
        appId,
        OR: captured.map(({ country, capturedAt }) => ({
          ...listingIn(home, country),
          capturedAt,
        })),
      },
      select: { country: true, ratingAvg: true, ratingCount: true },
    });
  }

  async marketDetail(
    app: AppWithListings,
    market: string,
    localization: AppStoreLocalization | null = null,
  ): Promise<AppDetail> {
    const loaded = await this.prisma.app.findFirst({
      where: { id: app.id },
      select: {
        snapshots: latestListingIn(app.country, market, localization),
        competitors: {
          select: { id: true, snapshots: latestListingIn(app.country, market) },
        },
      },
    });
    const own = loaded?.snapshots[0];
    if (!loaded || !own) {
      throw missingListing(market, localization);
    }
    const latest = new Map(
      loaded.competitors.map((rival) => [rival.id, rival.snapshots]),
    );
    const competitors = app.competitors.map((rival) => ({
      ...rival,
      snapshots: latest.get(rival.id) ?? [],
    }));
    return toAppDetail(app, own, competitors, app.group, localization);
  }
}
