import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppDetail, ListingMarket } from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';
import { toAppDetail, toListingMarkets, withTracking } from './apps.mapper';
import { EVERY_LISTING, latestListingIn } from './listing';

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
    const [rows, keywords] = await Promise.all([
      this.prisma.appSnapshot.groupBy({
        by: ['country'],
        where: { appId: id, ...EVERY_LISTING },
        _max: { capturedAt: true },
      }),
      this.prisma.keyword.findMany({
        where: { tracked: { some: { appId: app.primaryAppId ?? id } } },
        select: { country: true },
        distinct: ['country'],
      }),
    ]);
    return withTracking(
      toListingMarkets(app.country, rows),
      new Set(keywords.map((keyword) => keyword.country)),
    );
  }

  async marketDetail(app: AppWithListings, market: string): Promise<AppDetail> {
    const loaded = await this.prisma.app.findFirst({
      where: { id: app.id },
      select: {
        snapshots: latestListingIn(app.country, market),
        competitors: {
          select: { id: true, snapshots: latestListingIn(app.country, market) },
        },
      },
    });
    const own = loaded?.snapshots[0];
    if (!loaded || !own) {
      throw new NotFoundException(`No listing captured for ${market}`);
    }
    const latest = new Map(
      loaded.competitors.map((rival) => [rival.id, rival.snapshots]),
    );
    const competitors = app.competitors.map((rival) => ({
      ...rival,
      snapshots: latest.get(rival.id) ?? [],
    }));
    return toAppDetail(app, own, competitors, app.group);
  }
}
