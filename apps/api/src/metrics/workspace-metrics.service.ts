import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import {
  ON_DEMAND_ACTIONS,
  STORES,
  type OnDemandAction,
  type PlanLimits,
  type PlanName,
  type Store,
} from '@asobeast/shared';
import { planScopeOf } from '../auth/plan-limits';
import { windowKey } from '../auth/rate-limit/window';
import {
  CategoryRanksService,
  type CategoryBucket,
} from '../category-ranks/category-ranks.service';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { Env } from '../config/env';
import { previousDailyRun } from '../jobs/daily-schedule';
import { QUEUES } from '../jobs/jobs.types';
import { requestsFor } from '../jobs/request-weights';
import { PrismaService } from '../prisma/prisma.service';

const METRICS_JUSTIFICATION =
  'operator metrics summarise every workspace without reading their data';

const DAY_MS = 24 * 60 * 60_000;

export interface WorkspaceMetrics {
  workspaceId: string;
  plan: PlanName;
  limits: PlanLimits;
  suspended: boolean;
  apps: number;
  competitors: number;
  keywordMarkets: number;
  estimatedRequests: Record<Store, number>;
  capturedSinceTrigger: number;
  capturedYesterday: number;
  unresolvedSinceTrigger: number;
  runCompletedAt: Date | null;
  runIncomplete: boolean;
  storedRankings: number;
  storedReviews: number;
  onDemandUsed: Record<OnDemandAction, number>;
}

interface WorkspaceRow {
  id: string;
  plan: string;
  trialEndsAt: Date | null;
  planExpiresAt: Date | null;
  suspendedAt: Date | null;
}

interface AppRow {
  workspaceId: string;
  store: Store;
  isCompetitor: boolean;
  count: number;
}

interface StoreCountRow {
  workspaceId: string;
  store: Store;
  count: number;
}

interface CountRow {
  workspaceId: string;
  count: number;
}

interface RankingRow extends CountRow {
  unresolved: number;
  completedAt: Date | null;
}

interface RedisReader {
  mget(...keys: string[]): Promise<(string | null)[]>;
}

@Injectable()
export class WorkspaceMetricsCollector {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crossTenant: CrossTenantAccess,
    private readonly categoryRanks: CategoryRanksService,
    private readonly config: ConfigService<Env, true>,
    @InjectQueue(QUEUES.PIPELINE) private readonly queue: Queue,
  ) {}

  collect(now = new Date()): Promise<WorkspaceMetrics[]> {
    return this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      METRICS_JUSTIFICATION,
      () => this.gather(now),
    );
  }

  private async gather(now: Date): Promise<WorkspaceMetrics[]> {
    const trigger =
      previousDailyRun(this.config.get('CRON_DAILY', { infer: true }), now) ??
      new Date(now.getTime() - DAY_MS);

    const [
      workspaces,
      apps,
      keywords,
      buckets,
      since,
      before,
      rankings,
      reviews,
    ] = await Promise.all([
      this.workspaces(),
      this.appCounts(),
      this.keywordMarkets(),
      this.categoryRanks.bucketsByWorkspace(),
      this.rankingsSince(trigger),
      this.rankingsOn(utcDate(new Date(now.getTime() - DAY_MS))),
      this.storedRankings(),
      this.storedReviews(),
    ]);

    const scopes = new Map(
      workspaces.map((workspace) => [
        workspace.id,
        planScopeOf(
          this.config.get('BILLING_ENABLED', { infer: true }),
          workspace,
          now,
        ),
      ]),
    );
    const onDemand = await this.onDemandUsage(scopes, now);

    const appsBy = groupBy(apps);
    const keywordsBy = groupBy(keywords);
    const sinceBy = indexBy(since);
    const beforeBy = indexBy(before);
    const rankingsBy = indexBy(rankings);
    const reviewsBy = indexBy(reviews);

    return workspaces.map((workspace) => {
      const scope = scopes.get(workspace.id)!;
      const markets = keywordsBy.get(workspace.id) ?? [];
      const owned = appsBy.get(workspace.id) ?? [];
      const captured = sinceBy.get(workspace.id);
      const keywordMarkets = sum(markets);

      return {
        workspaceId: workspace.id,
        plan: scope.plan,
        limits: scope.limits,
        suspended: workspace.suspendedAt !== null,
        apps: sum(owned.filter((row) => !row.isCompetitor)),
        competitors: sum(owned.filter((row) => row.isCompetitor)),
        keywordMarkets,
        estimatedRequests: estimatedRequests(
          owned,
          markets,
          buckets.get(workspace.id) ?? [],
        ),
        capturedSinceTrigger: captured?.count ?? 0,
        capturedYesterday: beforeBy.get(workspace.id)?.count ?? 0,
        unresolvedSinceTrigger: captured?.unresolved ?? 0,
        runCompletedAt: captured?.completedAt ?? null,
        runIncomplete:
          keywordMarkets > 0 && (captured?.count ?? 0) < keywordMarkets,
        storedRankings: rankingsBy.get(workspace.id)?.count ?? 0,
        storedReviews: reviewsBy.get(workspace.id)?.count ?? 0,
        onDemandUsed: onDemand.get(workspace.id) ?? emptyOnDemand(),
      };
    });
  }

  private workspaces(): Promise<WorkspaceRow[]> {
    return this.prisma.workspace.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        plan: true,
        trialEndsAt: true,
        planExpiresAt: true,
        suspendedAt: true,
      },
    });
  }

  private async appCounts(): Promise<AppRow[]> {
    const rows = await this.prisma.app.groupBy({
      by: ['workspaceId', 'store', 'isCompetitor'],
      _count: { _all: true },
    });
    return rows.map((row) => ({
      workspaceId: row.workspaceId,
      store: row.store,
      isCompetitor: row.isCompetitor,
      count: row._count._all,
    }));
  }

  private keywordMarkets(): Promise<StoreCountRow[]> {
    return this.prisma.$queryRaw<StoreCountRow[]>`
      SELECT a."workspaceId", k."store", COUNT(DISTINCT t."keywordId")::int AS count
      FROM "TrackedKeyword" t
      JOIN "App" a ON a."id" = t."appId"
      JOIN "Keyword" k ON k."id" = t."keywordId"
      WHERE t."active" = true
      GROUP BY 1, 2
    `;
  }

  private rankingsSince(trigger: Date): Promise<RankingRow[]> {
    return this.prisma.$queryRaw<RankingRow[]>`
      SELECT "workspaceId",
             COUNT(*)::int AS count,
             COUNT(*) FILTER (WHERE "position" IS NULL)::int AS unresolved,
             MAX("createdAt") AS "completedAt"
      FROM "KeywordRanking"
      WHERE "createdAt" >= ${trigger}
      GROUP BY 1
    `;
  }

  private async rankingsOn(date: Date): Promise<CountRow[]> {
    return this.countRows(
      await this.prisma.keywordRanking.groupBy({
        by: ['workspaceId'],
        where: { date },
        _count: { _all: true },
      }),
    );
  }

  private async storedRankings(): Promise<CountRow[]> {
    return this.countRows(
      await this.prisma.keywordRanking.groupBy({
        by: ['workspaceId'],
        _count: { _all: true },
      }),
    );
  }

  private storedReviews(): Promise<CountRow[]> {
    return this.prisma.$queryRaw<CountRow[]>`
      SELECT a."workspaceId", COUNT(*)::int AS count
      FROM "Review" r
      JOIN "App" a ON a."id" = r."appId"
      GROUP BY 1
    `;
  }

  private countRows(
    rows: { workspaceId: string; _count: { _all: number } }[],
  ): CountRow[] {
    return rows.map((row) => ({
      workspaceId: row.workspaceId,
      count: row._count._all,
    }));
  }

  private async onDemandUsage(
    scopes: Map<string, { limits: PlanLimits }>,
    now: Date,
  ): Promise<Map<string, Record<OnDemandAction, number>>> {
    const usage = new Map<string, Record<OnDemandAction, number>>();
    const metered = [...scopes].filter(([, scope]) => scope.limits.onDemand);
    if (metered.length === 0) return usage;

    const keys = metered.flatMap(([workspaceId, scope]) =>
      ON_DEMAND_ACTIONS.map((action) =>
        windowKey(
          'on-demand',
          workspaceId,
          action,
          scope.limits.onDemand![action].windowSeconds,
          now,
        ),
      ),
    );
    const client = (await this.queue.getBackend()
      .client) as unknown as RedisReader;
    const values = await client.mget(...keys);

    metered.forEach(([workspaceId], index) => {
      const counts = emptyOnDemand();
      ON_DEMAND_ACTIONS.forEach((action, offset) => {
        counts[action] = toCount(
          values[index * ON_DEMAND_ACTIONS.length + offset],
        );
      });
      usage.set(workspaceId, counts);
    });
    return usage;
  }
}

function emptyOnDemand(): Record<OnDemandAction, number> {
  return Object.fromEntries(
    ON_DEMAND_ACTIONS.map((action) => [action, 0]),
  ) as Record<OnDemandAction, number>;
}

function toCount(raw: string | null | undefined): number {
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

function sum(rows: { count: number }[]): number {
  return rows.reduce((total, row) => total + row.count, 0);
}

function groupBy<T extends { workspaceId: string }>(
  rows: T[],
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const group = grouped.get(row.workspaceId);
    if (group) group.push(row);
    else grouped.set(row.workspaceId, [row]);
  }
  return grouped;
}

function indexBy<T extends { workspaceId: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((row) => [row.workspaceId, row]));
}

function estimatedRequests(
  apps: AppRow[],
  markets: StoreCountRow[],
  buckets: CategoryBucket[],
): Record<Store, number> {
  return Object.fromEntries(
    STORES.map((store) => [
      store,
      requestsFor(store, {
        apps: sum(apps.filter((row) => row.store === store)),
        keywords: sum(markets.filter((row) => row.store === store)),
        categories: buckets.filter((bucket) => bucket.store === store).length,
        reviews: sum(
          apps.filter((row) => row.store === store && !row.isCompetitor),
        ),
      }),
    ]),
  ) as Record<Store, number>;
}

function utcDate(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}
