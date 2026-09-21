import { Injectable, Logger } from '@nestjs/common';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { PrismaService } from '../prisma/prisma.service';
import { ApplePopularityClient, PopularityRow } from './apple-popularity';

export const APPLE_ADS_WEEKS_KEPT = 8;
export const POPULARITY_WRITE_CHUNK = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export interface PopularitySyncResult {
  countries: number;
  rows: number;
  week: string;
}

const dateKey = (date: Date): string => date.toISOString().slice(0, 10);

export function newestCompleteWeek(now: Date): Date {
  const cutoff = new Date(now.getTime() - WEEK_MS);
  const day = Date.UTC(
    cutoff.getUTCFullYear(),
    cutoff.getUTCMonth(),
    cutoff.getUTCDate(),
  );
  return new Date(day - cutoff.getUTCDay() * DAY_MS);
}

@Injectable()
export class ApplePopularitySync {
  private readonly logger = new Logger(ApplePopularitySync.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crossTenant: CrossTenantAccess,
    private readonly client: ApplePopularityClient,
  ) {}

  get enabled(): boolean {
    return this.client.enabled;
  }

  async run(now: Date): Promise<PopularitySyncResult> {
    const newest = newestCompleteWeek(now);
    const countries = await this.trackedCountries();
    let rows = 0;
    let failed = 0;
    for (const country of countries) {
      try {
        rows += await this.syncCountry(country, newest);
      } catch (error) {
        failed += 1;
        this.logger.warn(
          `apple search popularity failed for ${country}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    if (countries.length > 0 && failed === countries.length) {
      throw new Error('Apple search popularity failed for every market');
    }
    return { countries: countries.length, rows, week: dateKey(newest) };
  }

  private async trackedCountries(): Promise<string[]> {
    const keywords =
      await this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
        'apple search popularity covers every market any workspace tracks',
        () =>
          this.prisma.keyword.findMany({
            where: { store: 'APP_STORE', tracked: { some: { active: true } } },
            distinct: ['country'],
            select: { country: true },
          }),
      );
    return keywords.map(({ country }) => country);
  }

  private async syncCountry(country: string, newest: Date): Promise<number> {
    for (const week of [newest, new Date(newest.getTime() - WEEK_MS)]) {
      const rows = await this.client.weekOf(country, dateKey(week));
      if (rows.length > 0) {
        await this.store(rows);
        await this.prune(country, week);
        return rows.length;
      }
    }
    return 0;
  }

  private async store(rows: PopularityRow[]): Promise<void> {
    for (let start = 0; start < rows.length; start += POPULARITY_WRITE_CHUNK) {
      await this.prisma.searchTermPopularity.createMany({
        data: rows
          .slice(start, start + POPULARITY_WRITE_CHUNK)
          .map((row) => ({ ...row, week: new Date(`${row.week}T00:00:00Z`) })),
        skipDuplicates: true,
      });
    }
  }

  private async prune(country: string, week: Date): Promise<void> {
    await this.prisma.searchTermPopularity.deleteMany({
      where: {
        country,
        week: {
          lt: new Date(week.getTime() - (APPLE_ADS_WEEKS_KEPT - 1) * WEEK_MS),
        },
      },
    });
  }
}
