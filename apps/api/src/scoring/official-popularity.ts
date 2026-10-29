import { Injectable } from '@nestjs/common';
import { Store } from '@prisma/client';
import { OfficialPopularityListing, utcDayOf } from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ApplePopularityClient } from './apple-popularity';
import { OfficialContext, OfficialPopularity } from './formulas';

export const POPULARITY_MAX_AGE_DAYS = 28;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface PopularityKeyword {
  text: string;
  store: Store;
  country: string;
}

interface ListedTerm {
  popularity: number;
  genres: string[];
}

interface FloorScope {
  country: string;
  week: Date;
  genre?: string | { in: string[] };
}

function highestListing(
  rows: { genre: string; popularity: number }[],
): ListedTerm | null {
  if (rows.length === 0) {
    return null;
  }
  const popularity = Math.max(...rows.map((row) => row.popularity));
  return {
    popularity,
    genres: rows
      .filter((row) => row.popularity === popularity)
      .map((row) => row.genre),
  };
}

@Injectable()
export class OfficialPopularityLookup {
  constructor(
    private readonly prisma: PrismaService,
    private readonly client: ApplePopularityClient,
  ) {}

  async for(
    keyword: PopularityKeyword,
    genre?: string,
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
    const listed = highestListing(
      await this.prisma.searchTermPopularity.findMany({
        where: {
          country: keyword.country,
          week: latest.week,
          term: keyword.text,
        },
        select: { genre: true, popularity: true },
      }),
    );
    return listed
      ? this.listedAnswer(keyword, latest.week, listed)
      : this.absentAnswer(keyword, latest.week, genre);
  }

  private async listedAnswer(
    keyword: PopularityKeyword,
    week: Date,
    listed: ListedTerm,
  ): Promise<OfficialPopularity> {
    const floor =
      (await this.floor({
        country: keyword.country,
        week,
        genre: { in: listed.genres },
      })) ?? listed.popularity;
    return {
      value: listed.popularity,
      context: await this.contextOf(
        keyword,
        week,
        floor,
        listed.popularity <= floor,
      ),
    };
  }

  private async absentAnswer(
    keyword: PopularityKeyword,
    week: Date,
    genre?: string,
  ): Promise<OfficialPopularity | undefined> {
    const where = { country: keyword.country, week };
    const floor =
      (genre === undefined ? null : await this.floor({ ...where, genre })) ??
      (await this.floor(where));
    return floor === null
      ? undefined
      : {
          absentBelow: floor,
          context: await this.contextOf(keyword, week, floor, true),
        };
  }

  private async contextOf(
    keyword: PopularityKeyword,
    week: Date,
    floor: number,
    withHistory: boolean,
  ): Promise<OfficialContext> {
    return {
      week: utcDayOf(week),
      floor,
      lastAboveFloor: withHistory
        ? await this.lastAboveFloor(keyword, week, floor)
        : null,
    };
  }

  private async lastAboveFloor(
    keyword: PopularityKeyword,
    before: Date,
    floor: number,
  ): Promise<OfficialPopularityListing | null> {
    const row = await this.prisma.searchTermPopularity.findFirst({
      where: {
        country: keyword.country,
        term: keyword.text,
        week: { lt: before },
        popularity: { gt: floor },
      },
      orderBy: [{ week: 'desc' }, { popularity: 'desc' }],
      select: { week: true, popularity: true },
    });
    return row ? { value: row.popularity, week: utcDayOf(row.week) } : null;
  }

  private async floor(where: FloorScope): Promise<number | null> {
    const lowest = await this.prisma.searchTermPopularity.aggregate({
      where,
      _min: { popularity: true },
    });
    return lowest._min.popularity;
  }
}
