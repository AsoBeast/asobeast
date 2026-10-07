import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppDetail, ListingMarket } from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';
import { toAppDetail, toListingMarkets } from './apps.mapper';
import { EVERY_LISTING, listingIn, NEWEST_FIRST } from './listing';

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
    const rows = await this.prisma.appSnapshot.findMany({
      where: {
        appId: { in: [app.id, ...app.competitors.map((rival) => rival.id)] },
        ...listingIn(app.country, market),
      },
      orderBy: NEWEST_FIRST,
      distinct: ['appId'],
    });
    const latest = new Map(rows.map((row) => [row.appId, row]));
    const own = latest.get(app.id);
    if (!own) {
      throw new NotFoundException(`No listing captured for ${market}`);
    }
    const competitors = app.competitors.map((rival) => {
      const listing = latest.get(rival.id);
      return { ...rival, snapshots: listing ? [listing] : [] };
    });
    return toAppDetail(app, own, competitors, app.group);
  }
}
