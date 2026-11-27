import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Store } from '@prisma/client';
import { KeywordScope, RankingSeries } from '@asobeast/shared';
import { CollectionEligibility } from '../auth/collection-eligibility.service';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { PrismaService } from '../prisma/prisma.service';
import { RankingHistoryQueryDto } from './dto/ranking-history-query.dto';
import { CompetitorCapture, RankCapture } from './rank-milestones';
import { RankingAlertsService } from './ranking-alerts.service';
import { DAY_MS, toDateKey, utcToday } from './rankings.support';
import {
  positionsByStoreAppId,
  reachedDepth,
  SerpCapture,
} from './serp-capture';
import { SerpSnapshotDay } from './serp-movers';
import { topTenOf } from './top-ten';

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
  depth: number;
  resultCount: number | null;
  primaryNames: Map<string, string | null>;
  competitorsOf: Map<string, CompetitorRef[]>;
}

@Injectable()
export class RankingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly capture: SerpCapture,
    private readonly rankingAlerts: RankingAlertsService,
    private readonly workspace: WorkspaceContext,
    private readonly crossTenant: CrossTenantAccess,
    private readonly eligibility: CollectionEligibility,
  ) {}

  async checkKeyword(keywordId: string, finalAttempt = false): Promise<void> {
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

    const answer = await this.capture.search(keyword, finalAttempt);
    if (!answer) return;
    const { results, resultCount } = answer;

    const positionByStoreAppId = positionsByStoreAppId(results);
    const depth = reachedDepth(results);
    const date = utcToday();
    const baseline = await this.rankingAlerts.entrantBaseline(keywordId, date);
    const entries = await this.capture.store(keywordId, date, results);

    const today: SerpSnapshotDay = {
      date: toDateKey(date),
      entries: topTenOf(entries).map(({ position, storeAppId, title }) => ({
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
          depth,
          resultCount,
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
    const {
      owned,
      keyword,
      date,
      positionByStoreAppId,
      depth,
      resultCount,
      primaryNames,
    } = input;
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
          depth,
          resultCount,
        },
        update: { position, depth, resultCount },
      });

      const changed = existing === null || existing.position !== position;
      captures.set(appId, { position, changed });
      if (primaryNames.has(appId) && changed) {
        await this.rankingAlerts.dispatchRankAlert(
          { id: appId, name: primaryNames.get(appId) ?? null },
          keyword,
          date,
          { position, depth, resultCount },
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
        depth: input.depth,
        resultCount: input.resultCount,
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
        ...trackedScope(requested, query.includePaused),
        ...(query.country ? { keyword: { country: query.country } } : {}),
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
              select: {
                date: true,
                position: true,
                depth: true,
                resultCount: true,
              },
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
          resultCount: ranking.resultCount,
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

function trackedScope(
  requested: string[] | undefined,
  includePaused: boolean | undefined,
): Prisma.TrackedKeywordWhereInput {
  if (requested) return { keywordId: { in: requested } };
  return includePaused ? {} : { active: true };
}
