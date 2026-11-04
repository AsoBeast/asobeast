import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { POPULARITY_MAX_AGE_DAYS } from '../scoring/official-popularity';
import { officialTraffic } from '../scoring/traffic';
import { PopularityTerm } from './popularity-terms';

const DAY_MS = 24 * 60 * 60 * 1000;
const GENRE_TERMS_LIMIT = 500;

@Injectable()
export class DiscoveryPopularity {
  constructor(private readonly prisma: PrismaService) {}

  async weekFor(country: string): Promise<Date | null> {
    const latest = await this.prisma.searchTermPopularity.findFirst({
      where: {
        country,
        week: { gte: new Date(Date.now() - POPULARITY_MAX_AGE_DAYS * DAY_MS) },
      },
      orderBy: { week: 'desc' },
      select: { week: true },
    });
    return latest?.week ?? null;
  }

  async genreTerms(country: string, genre: string): Promise<PopularityTerm[]> {
    const week = await this.weekFor(country);
    if (!week) return [];
    return this.prisma.searchTermPopularity.findMany({
      where: { country, week, genre },
      orderBy: { popularity: 'desc' },
      take: GENRE_TERMS_LIMIT,
      select: { term: true, popularity: true },
    });
  }

  async listedTraffic(
    country: string,
    texts: readonly string[],
  ): Promise<Map<string, number>> {
    const traffic = new Map<string, number>();
    if (texts.length === 0) return traffic;
    const week = await this.weekFor(country);
    if (!week) return traffic;
    const rows = await this.prisma.searchTermPopularity.findMany({
      where: { country, week, term: { in: [...texts] } },
      select: { term: true, popularity: true },
    });
    const highest = new Map<string, number>();
    for (const { term, popularity } of rows) {
      highest.set(term, Math.max(highest.get(term) ?? 0, popularity));
    }
    for (const [term, popularity] of highest) {
      traffic.set(term, officialTraffic(popularity));
    }
    return traffic;
  }
}
