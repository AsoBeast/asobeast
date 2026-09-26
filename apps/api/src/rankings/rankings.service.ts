import { Injectable, NotFoundException } from '@nestjs/common';
import { Store } from '@prisma/client';
import {
  KeywordScope,
  RANK_DEPTH,
  RankingSeries,
  SERP_DEPTH,
} from '@asobeast/shared';
import { CollectionEligibility } from '../auth/collection-eligibility.service';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { PrismaService } from '../prisma/prisma.service';
import { ImplausibleResultError } from '../store-providers/errors';
import { isImplausiblyEmpty } from '../store-providers/result-plausibility';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { RankingHistoryQueryDto } from './dto/ranking-history-query.dto';
import { CompetitorCapture, RankCapture } from './rank-milestones';
import { RankingAlertsService } from './ranking-alerts.service';
import { DAY_MS, toDateKey, utcToday } from './rankings.support';
import { SerpSnapshotDay } from './serp-movers';

const HISTORY_DAYS = 30;

interface RankedApp {
  storeAppId: string;
  workspaceId: string;
}

interface CompetitorRef {
  id: string;
  name: string | null;
}

interface TrackedApps {
  apps: Map<string, RankedApp>;
  primaryNames: Map<string, string | null>;
  competitorsOf: Map<string, CompetitorRef[]>;
}

interface RecordInput {
  owned: Map<string, RankedApp>;
  keyword: KeywordScope;
  date: Date;
  positionByStoreAppId: Map<string, number>;
  primaryNames: Map<string, string | null>;
  competitorsOf: Map<string, CompetitorRef[]>;
}

@Injectable()
export class RankingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: StoreProviderRegistry,
    private readonly rankingAlerts: RankingAlertsService,
    private readonly workspace: WorkspaceContext,
    private readonly crossTenant: CrossTenantAccess,
    private readonly eligibility: CollectionEligibility,
  ) {}

  async checkKeyword(keywordId: string): Promise<void> {
    const keyword = await this.prisma.keyword.findUnique({
      where: { id: keywordId },
      select: { id: true, text: true, store: true, country: true },
    });
    if (!keyword) {
      return;
    }

    const tracked =
      await this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
        'one search serves every workspace tracking the phrase in that market',
        () => this.trackedApps(keywordId, keyword.store),
      );
    const { apps, primaryNames, competitorsOf } = await this.collectableFor(
      tracked,
      keywordId,
    );
    if (apps.size === 0) {
      return;
    }

    const results = await this.registry
      .get(keyword.store)
      .search(keyword.text, keyword.country, RANK_DEPTH);
    await this.rejectImplausibleEmptyResult(keyword, results.length);

    const positionByStoreAppId = new Map<string, number>();
    results.forEach((item, index) => {
      if (!positionByStoreAppId.has(item.storeAppId)) {
        positionByStoreAppId.set(item.storeAppId, index + 1);
      }
    });

    const date = utcToday();
    const entries = results.slice(0, SERP_DEPTH).map((item, index) => ({
      keywordId,
      date,
      position: index + 1,
      storeAppId: item.storeAppId,
      title: item.title,
      developer: item.developer ?? null,
      ratingAvg: item.ratingAvg ?? null,
      ratingCount: item.ratingCount ?? null,
    }));
    const baseline = await this.rankingAlerts.entrantBaseline(keywordId, date);

    await this.prisma.withTransaction(async (tx) => {
      await tx.serpEntry.deleteMany({ where: { keywordId, date } });
      await tx.serpEntry.createMany({ data: entries });
    });

    const today: SerpSnapshotDay = {
      date: toDateKey(date),
      entries: entries.map(({ position, storeAppId, title }) => ({
        position,
        storeAppId,
        title,
      })),
    };

    for (const [workspaceId, owned] of groupByWorkspace(apps)) {
      await this.workspace.run(workspaceId, async () => {
        await this.recordPositions({
          owned,
          keyword,
          date,
          positionByStoreAppId,
          primaryNames,
          competitorsOf,
        });
        if (baseline) {
          await this.rankingAlerts.dispatchEntrantAlert(keyword, [
            baseline,
            today,
          ]);
        }
      });
    }
  }

  private async rejectImplausibleEmptyResult(
    keyword: { id: string; text: string; store: Store; country: string },
    resultCount: number,
  ): Promise<void> {
    if (resultCount > 0) return;
    const today = utcToday();
    const previous = await this.prisma.serpEntry.findFirst({
      where: { keywordId: keyword.id, date: { lt: today } },
      orderBy: { date: 'desc' },
      select: { date: true },
    });
    if (!previous) return;
    if (
      !isImplausiblyEmpty({ resultCount, lastSeenOn: previous.date, today })
    ) {
      return;
    }
    throw new ImplausibleResultError(
      keyword.store,
      `"${keyword.text}" returned no results in ${keyword.country} but ranked apps on ${toDateKey(previous.date)}`,
    );
  }

  private async collectableFor(
    tracked: TrackedApps,
    keywordId: string,
  ): Promise<TrackedApps> {
    if (tracked.apps.size === 0) return tracked;

    const eligible = await this.eligibility.forKeyword(
      [...tracked.apps.values()].map((app) => app.workspaceId),
      keywordId,
    );
    const apps = new Map(
      [...tracked.apps].filter(([, app]) => eligible.has(app.workspaceId)),
    );
    const primaryNames = new Map(
      [...tracked.primaryNames].filter(([appId]) => apps.has(appId)),
    );
    const competitorsOf = new Map(
      [...tracked.competitorsOf].filter(([appId]) => apps.has(appId)),
    );
    return { apps, primaryNames, competitorsOf };
  }

  private async recordPositions(input: RecordInput): Promise<void> {
    const { owned, keyword, date, positionByStoreAppId, primaryNames } = input;
    const captures = new Map<string, RankCapture>();
    for (const [appId, { storeAppId, workspaceId }] of owned) {
      const position = positionByStoreAppId.get(storeAppId) ?? null;
      const existing = await this.prisma.keywordRanking.findUnique({
        where: { appId_keywordId_date: { appId, keywordId: keyword.id, date } },
        select: { position: true },
      });
      await this.prisma.keywordRanking.upsert({
        where: { appId_keywordId_date: { appId, keywordId: keyword.id, date } },
        create: {
          appId,
          workspaceId,
          keywordId: keyword.id,
          date,
          position,
          depth: RANK_DEPTH,
        },
        update: { position, depth: RANK_DEPTH },
      });

      const changed = existing === null || existing.position !== position;
      captures.set(appId, { position, changed });
      if (primaryNames.has(appId) && changed) {
        await this.rankingAlerts.dispatchRankAlert(
          { id: appId, name: primaryNames.get(appId) ?? null },
          keyword,
          date,
          { position, depth: RANK_DEPTH },
        );
      }
    }
    await this.dispatchMilestones(input, captures);
  }

  private async dispatchMilestones(
    input: RecordInput,
    captures: Map<string, RankCapture>,
  ): Promise<void> {
    for (const [appId, capture] of captures) {
      if (!input.primaryNames.has(appId)) continue;
      const competitors = (input.competitorsOf.get(appId) ?? []).flatMap(
        (competitor): CompetitorCapture[] => {
          const current = captures.get(competitor.id);
          return current ? [{ ...competitor, ...current }] : [];
        },
      );
      await this.rankingAlerts.dispatchMilestoneAlerts({
        app: { id: appId, name: input.primaryNames.get(appId) ?? null },
        keyword: input.keyword,
        date: input.date,
        depth: RANK_DEPTH,
        capture,
        competitors,
      });
    }
  }

  private async trackedApps(
    keywordId: string,
    store: Store,
  ): Promise<TrackedApps> {
    const tracked = await this.prisma.trackedKeyword.findMany({
      where: { keywordId, active: true, app: { store } },
      select: {
        app: {
          select: {
            id: true,
            name: true,
            storeAppId: true,
            workspaceId: true,
            competitors: {
              select: {
                id: true,
                name: true,
                storeAppId: true,
                workspaceId: true,
              },
            },
          },
        },
      },
    });

    const apps = new Map<string, RankedApp>();
    const primaryNames = new Map<string, string | null>();
    const competitorsOf = new Map<string, CompetitorRef[]>();
    for (const { app } of tracked) {
      apps.set(app.id, {
        storeAppId: app.storeAppId,
        workspaceId: app.workspaceId,
      });
      primaryNames.set(app.id, app.name);
      competitorsOf.set(
        app.id,
        app.competitors.map(({ id, name }) => ({ id, name })),
      );
      for (const competitor of app.competitors) {
        apps.set(competitor.id, {
          storeAppId: competitor.storeAppId,
          workspaceId: competitor.workspaceId,
        });
      }
    }
    return { apps, primaryNames, competitorsOf };
  }

  async history(
    appId: string,
    query: RankingHistoryQueryDto,
  ): Promise<RankingSeries> {
    await this.ensureApp(appId);

    const to = query.to ? new Date(query.to) : utcToday();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - HISTORY_DAYS * DAY_MS);

    const requested = query.keywordIds
      ?.split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    const tracked = await this.prisma.trackedKeyword.findMany({
      where: {
        appId,
        ...(requested ? { keywordId: { in: requested } } : { active: true }),
      },
      orderBy: { createdAt: 'asc' },
      select: {
        keywordId: true,
        keyword: {
          select: {
            text: true,
            store: true,
            country: true,
            rankings: {
              where: { appId, date: { gte: from, lte: to } },
              orderBy: { date: 'asc' },
              select: { date: true, position: true, depth: true },
            },
          },
        },
      },
    });

    return {
      series: tracked.map((row) => ({
        keywordId: row.keywordId,
        text: row.keyword.text,
        store: row.keyword.store,
        country: row.keyword.country,
        points: row.keyword.rankings.map((ranking) => ({
          date: toDateKey(ranking.date),
          position: ranking.position,
          depth: ranking.depth,
        })),
      })),
    };
  }

  private async ensureApp(appId: string): Promise<void> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId },
      select: { id: true },
    });
    if (!app) {
      throw new NotFoundException(`App ${appId} not found`);
    }
  }
}

function groupByWorkspace(
  apps: Map<string, RankedApp>,
): Map<string, Map<string, RankedApp>> {
  const grouped = new Map<string, Map<string, RankedApp>>();
  for (const [appId, app] of apps) {
    const owned = grouped.get(app.workspaceId) ?? new Map<string, RankedApp>();
    owned.set(appId, app);
    grouped.set(app.workspaceId, owned);
  }
  return grouped;
}
