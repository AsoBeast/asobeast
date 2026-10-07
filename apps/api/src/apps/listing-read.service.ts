import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppDetail, ListingMarket } from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';
import { toAppDetail, toListingMarkets } from './apps.mapper';
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
      select: { country: true },
    });
    if (!app) {
      throw new NotFoundException(`App ${id} not found`);
    }
    const rows = await this.prisma.appSnapshot.groupBy({
      by: ['country'],
      where: { appId: id, ...EVERY_LISTING },
      _max: { capturedAt: true },
    });
    return toListingMarkets(app.country, rows);
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
