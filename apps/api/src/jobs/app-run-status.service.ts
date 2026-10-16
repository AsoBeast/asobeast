import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Store } from '@prisma/client';
import { appRunTotals, type AppRunStatus } from '@asobeast/shared';
import { startOfUtcDay } from '../analytics/analytics.support';
import { EVERY_LISTING, listingMarket } from '../apps/listing';
import { CollectionEligibility } from '../auth/collection-eligibility.service';
import { CategoryRanksService } from '../category-ranks/category-ranks.service';
import { rankedChartKey } from '../category-ranks/ranked-charts';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { appRunStages, type StageCount } from './app-run-stages';
import { appFamilyMarketListings } from './daily-targets.service';
import { previousDailyRun } from './daily-schedule';
import { utcDateKey } from './jobs.types';
import { runStateOf } from './run-state';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

interface FamilyMember {
  id: string;
  store: Store;
  country: string;
}

interface RunApp extends FamilyMember {
  competitors: FamilyMember[];
  tracked: { keyword: { country: string } }[];
}

interface CaptureRow {
  captured: number;
  lastCaptureAt: Date | null;
}

interface KeywordCount extends StageCount {
  lastCaptureAt: Date | null;
}

const listingKey = (appId: string, country: string): string =>
  `${appId}~${country}`;

@Injectable()
export class AppRunStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly categoryRanks: CategoryRanksService,
    private readonly eligibility: CollectionEligibility,
  ) {}

  async forApp(appId: string, now = new Date()): Promise<AppRunStatus> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId },
      select: {
        id: true,
        store: true,
        country: true,
        competitors: { select: { id: true, store: true, country: true } },
        tracked: {
          where: { active: true },
          select: { keyword: { select: { country: true } } },
        },
      },
    });
    if (!app) {
      throw new NotFoundException(`App ${appId} not found`);
    }

    const trigger =
      previousDailyRun(this.config.get('CRON_DAILY', { infer: true }), now) ??
      new Date(now.getTime() - DAY_MS);
    const since = new Date(
      Math.min(trigger.getTime(), startOfUtcDay(now).getTime()),
    );
    const [listings, keywords, categories, eligible] = await Promise.all([
      this.listings(app, since),
      this.keywords(app, since),
      this.categories(app.id, since),
      this.eligibility.forWorkspace(now),
    ]);
    const stages = appRunStages({ listings, keywords, categories });
    const totals = appRunTotals({ stages });

    return {
      appId,
      date: utcDateKey(since),
      state: runStateOf({
        tracked: totals.total,
        captured: totals.ready,
        hoursSinceTrigger: (now.getTime() - trigger.getTime()) / HOUR_MS,
      }),
      startedAt: trigger.toISOString(),
      lastCaptureAt: keywords.lastCaptureAt?.toISOString() ?? null,
      stages,
      paused: !eligible,
    };
  }

  private async listings(app: RunApp, since: Date): Promise<StageCount> {
    const family = [app, ...app.competitors];
    const homes = new Map(family.map((member) => [member.id, member.country]));
    const expected = new Set([
      ...family.map((member) => listingKey(member.id, member.country)),
      ...appFamilyMarketListings(app).map((target) =>
        listingKey(target.id, target.country),
      ),
    ]);
    const rows = await this.prisma.appSnapshot.findMany({
      where: {
        appId: { in: [...homes.keys()] },
        ...EVERY_LISTING,
        localization: null,
        capturedAt: { gte: since },
      },
      select: { appId: true, country: true },
      distinct: ['appId', 'country'],
    });
    const captured = rows.filter(({ appId, country }) => {
      const home = homes.get(appId);
      return (
        home !== undefined &&
        expected.has(listingKey(appId, listingMarket(home, country)))
      );
    });
    return { ready: captured.length, total: expected.size };
  }

  private async keywords(app: RunApp, since: Date): Promise<KeywordCount> {
    const [row] = await this.prisma.$queryRaw<CaptureRow[]>`
      SELECT COUNT(DISTINCT r."keywordId")::int AS captured,
             MAX(r."createdAt") AS "lastCaptureAt"
      FROM "KeywordRanking" r
      JOIN "TrackedKeyword" t
        ON t."keywordId" = r."keywordId" AND t."appId" = r."appId"
      WHERE t."appId" = ${app.id} AND t."active" = true
        AND r."createdAt" >= ${since}
    `;
    return {
      ready: row?.captured ?? 0,
      total: app.tracked.length,
      lastCaptureAt: row?.lastCaptureAt ?? null,
    };
  }

  private async categories(appId: string, since: Date): Promise<StageCount> {
    const expected = new Set(
      (await this.categoryRanks.rankedCharts(appId)).map(rankedChartKey),
    );
    const rows = await this.prisma.categoryRank.findMany({
      where: { appId, createdAt: { gte: since } },
      select: { collection: true, genre: true },
      distinct: ['collection', 'genre'],
    });
    return {
      ready: rows.filter((row) => expected.has(rankedChartKey(row))).length,
      total: expected.size,
    };
  }
}
