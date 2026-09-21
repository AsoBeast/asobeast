import { Injectable } from '@nestjs/common';
import { Store } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ApplePopularityClient } from './apple-popularity';
import { OfficialPopularity } from './formulas';

export const POPULARITY_MAX_AGE_DAYS = 28;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface PopularityKeyword {
  text: string;
  store: Store;
  country: string;
}

@Injectable()
export class OfficialPopularityLookup {
  constructor(
    private readonly prisma: PrismaService,
    private readonly client: ApplePopularityClient,
  ) {}

  async for(
    keyword: PopularityKeyword,
  ): Promise<OfficialPopularity | undefined> {
    if (!this.client.enabled || keyword.store !== Store.APP_STORE) {
      return undefined;
    }
    const latest = await this.prisma.searchTermPopularity.findFirst({
      where: {
        country: keyword.country,
        week: { gte: new Date(Date.now() - POPULARITY_MAX_AGE_DAYS * DAY_MS) },
      },
      orderBy: { week: 'desc' },
      select: { week: true },
    });
    if (!latest) {
      return undefined;
    }
    const where = { country: keyword.country, week: latest.week };
    const listed = await this.prisma.searchTermPopularity.aggregate({
      where: { ...where, term: keyword.text },
      _max: { popularity: true },
    });
    if (listed._max.popularity !== null) {
      return { value: listed._max.popularity };
    }
    const floor = await this.prisma.searchTermPopularity.aggregate({
      where,
      _min: { popularity: true },
    });
    return floor._min.popularity === null
      ? undefined
      : { absentBelow: floor._min.popularity };
  }
}
