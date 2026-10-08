import { Injectable } from '@nestjs/common';
import {
  assertStorefront,
  KeywordImportQuota,
  KeywordImportRequest,
  KeywordImportResult,
} from '@asobeast/shared';
import { QuotaService, WorkspaceUsage } from '../auth/quota.service';
import { PrismaService } from '../prisma/prisma.service';
import { ClassifiedRow, classifyImportRows, pairKey } from './keyword-import';
import {
  Addition,
  costOf,
  ImportPlan,
  planImport,
  summarize,
  TrackingLookup,
  TrackingState,
} from './keyword-import-plan';
import { KeywordTracker } from './keyword-tracker';
import { ensureApp, KeywordApp } from './keywords.support';
import { MarketListingRequests } from './market-listing.requests';

interface PlannedImport {
  app: KeywordApp;
  plan: ImportPlan;
  quota: KeywordImportQuota | null;
  marketListings: number;
}

@Injectable()
export class KeywordImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tracker: KeywordTracker,
    private readonly quota: QuotaService,
    private readonly listings: MarketListingRequests,
  ) {}

  async preview(
    appId: string,
    request: KeywordImportRequest,
  ): Promise<KeywordImportResult> {
    return this.result(await this.planned(appId, request), 0, true);
  }

  async import(
    appId: string,
    request: KeywordImportRequest,
  ): Promise<KeywordImportResult> {
    const planned = await this.planned(appId, request);
    const imported = await this.write(planned.app, planned.plan.additions);
    const quota =
      planned.quota && imported > 0
        ? this.quotaOf(await this.quota.usage())
        : planned.quota;
    return this.result({ ...planned, quota }, imported, false);
  }

  private async planned(
    appId: string,
    request: KeywordImportRequest,
  ): Promise<PlannedImport> {
    const app = await ensureApp(this.prisma, appId);
    const context = {
      store: app.store,
      country: request.country ?? app.country,
    };
    assertStorefront(context.store, context.country);
    const classified = classifyImportRows(request.rows, context);
    const [tracking, usage] = await Promise.all([
      this.trackingFor(app, classified),
      this.quota.usage(),
    ]);
    const limit = usage.limits.keywordMarkets;
    const room =
      limit === null ? null : Math.max(0, limit - usage.keywordMarkets);
    const plan = planImport(classified, tracking, room);
    return {
      app,
      plan,
      quota: this.quotaOf(usage),
      marketListings: await this.listingsOpened(app, plan.additions),
    };
  }

  private async listingsOpened(
    app: KeywordApp,
    additions: readonly Addition[],
  ): Promise<number> {
    const markets = [
      ...new Set(additions.map(({ candidate }) => candidate.country)),
    ].filter((country) => country !== app.country);
    if (markets.length === 0) {
      return 0;
    }
    const [tracked, family] = await Promise.all([
      this.prisma.keyword.findMany({
        where: {
          store: app.store,
          country: { in: markets },
          tracked: { some: { appId: app.id, active: true } },
        },
        select: { country: true },
        distinct: ['country'],
      }),
      this.prisma.app.count({
        where: { OR: [{ id: app.id }, { primaryAppId: app.id }] },
      }),
    ]);
    return (markets.length - tracked.length) * family;
  }

  private async write(
    app: KeywordApp,
    additions: readonly Addition[],
  ): Promise<number> {
    if (additions.length === 0) {
      return 0;
    }
    const ids = await this.tracker.keywordIdsAcrossMarkets(
      additions.map(({ candidate }) => ({
        text: candidate.text,
        country: candidate.country,
      })),
      app.store,
    );
    const located = additions.flatMap((addition) => {
      const keywordId = ids.get(
        pairKey(addition.candidate.country, addition.candidate.text),
      );
      return keywordId ? [{ addition, keywordId }] : [];
    });
    const created = located.filter(({ addition }) => addition.status === 'new');
    const resumed = located.filter(
      ({ addition }) => addition.status === 'resume',
    );
    let imported = 0;
    await this.quota.admitKeywordMarkets(async (tx) => {
      const added = await tx.trackedKeyword.createMany({
        data: created.map(({ addition, keywordId }) => ({
          appId: app.id,
          keywordId,
          source: 'MANUAL' as const,
          active: true,
          tags: addition.candidate.tags,
          note: addition.candidate.note,
        })),
        skipDuplicates: true,
      });
      const reactivated = await tx.trackedKeyword.updateMany({
        where: {
          appId: app.id,
          active: false,
          keywordId: { in: resumed.map(({ keywordId }) => keywordId) },
        },
        data: { active: true },
      });
      await this.tracker.claimForManual(
        tx,
        app.id,
        located.map(({ keywordId }) => keywordId),
      );
      imported = added.count + reactivated.count;
    });
    await this.tracker.enqueueFirstScores(
      located.map(({ keywordId }) => keywordId),
      app,
    );
    const markets = new Set(
      located.map(({ addition }) => addition.candidate.country),
    );
    for (const market of markets) {
      await this.listings.request(app, market);
    }
    return imported;
  }

  private result(
    { app, plan, quota, marketListings }: PlannedImport,
    imported: number,
    dryRun: boolean,
  ): KeywordImportResult {
    return {
      dryRun,
      imported,
      summary: summarize(plan.results),
      cost: costOf(plan.additions, app.store, marketListings),
      quota,
      results: plan.results,
    };
  }

  private quotaOf(usage: WorkspaceUsage): KeywordImportQuota | null {
    const limit = usage.limits.keywordMarkets;
    if (limit === null) {
      return null;
    }
    return {
      used: usage.keywordMarkets,
      limit,
      upgradeTo: this.quota.upgradeFrom(usage.plan),
    };
  }

  private async trackingFor(
    app: KeywordApp,
    classified: readonly ClassifiedRow[],
  ): Promise<TrackingLookup> {
    const candidates = classified.flatMap((row) =>
      row.kind === 'candidate' ? [row.candidate] : [],
    );
    if (candidates.length === 0) {
      return new Map();
    }
    const rows = await this.prisma.trackedKeyword.findMany({
      where: {
        keyword: {
          is: {
            store: app.store,
            text: { in: [...new Set(candidates.map(({ text }) => text))] },
            country: {
              in: [...new Set(candidates.map(({ country }) => country))],
            },
          },
        },
      },
      select: {
        appId: true,
        active: true,
        keyword: { select: { text: true, country: true } },
      },
    });
    const states = new Map<string, TrackingState>();
    for (const row of rows) {
      const key = pairKey(row.keyword.country, row.keyword.text);
      const state = states.get(key) ?? { own: null, elsewhere: false };
      if (row.appId === app.id) {
        state.own = row.active ? 'active' : 'paused';
      } else if (row.active) {
        state.elsewhere = true;
      }
      states.set(key, state);
    }
    return states;
  }
}
